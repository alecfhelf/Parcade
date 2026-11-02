-- Parcade: Delete account (App Store guideline 5.1.1(v), and on the website too)
-- Paste into the Supabase SQL Editor and run. Safe to run more than once (create or replace).
--
-- netlify/functions/delete-account.mjs calls delete_account_prepare(user) with the service role, then deletes the
-- auth user. Prepare runs first so nothing other people still use goes with the account:
--   * players rows stay in their rounds as "Deleted player" with no user_id
--   * rounds they host go to another player in the round, or lose their host (deleted only if it's their solo round
--     and host_id can't be empty)
--   * seasons they own go to the longest-standing other member, or are deleted (same children as delete_season)
--   * tournaments they own go to another member (captains first); with nobody else in it, the tournament goes
--     with the account (tournaments.owner_id is on delete cascade)
--   * anything else pointing at auth.users without a cascade is cleared (nullable) or removed (not null)
-- Coins, items, ledger, Club and comp rows, season and tournament memberships cascade when the auth user is deleted.

begin;

-- ---------- tournaments_guard: same as tournaments.sql, plus an account deletion may hand the tournament on ----------
-- parcade.account_delete is only ever set inside delete_account_prepare (service role only).
create or replace function public.tournaments_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    new.status := 'setup';
    new.started_at := null;
    new.finished_at := null;
    new.created_at := now();
    new.code := public.tournament_code();
    return new;
  end if;
  if coalesce(current_setting('parcade.account_delete', true), '') = '1'
     and new.owner_id is distinct from old.owner_id
     and row(new.id, new.code, new.created_at, new.status, new.started_at, new.finished_at)
         is not distinct from row(old.id, old.code, old.created_at, old.status, old.started_at, old.finished_at) then
    return new;
  end if;
  if new.id is distinct from old.id or new.code is distinct from old.code or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at then
    raise exception 'That can''t change.';
  end if;
  if public.tn_trusted() then return new; end if;
  if new.status is distinct from old.status or new.started_at is distinct from old.started_at
     or new.finished_at is distinct from old.finished_at then
    raise exception 'Use Start or End to change the tournament status.';
  end if;
  if old.status <> 'setup' and (row(new.mode, new.handicap, new.team_size, new.team_count, new.schedule, new.holes_per_match,
      new.third_place, new.tiebreak, new.seeding, new.buy_in, new.payouts, new.course_id)
      is distinct from row(old.mode, old.handicap, old.team_size, old.team_count, old.schedule, old.holes_per_match,
      old.third_place, old.tiebreak, old.seeding, old.buy_in, old.payouts, old.course_id)) then
    raise exception 'Settings are locked once the tournament starts.';
  end if;
  return new;
end $$;

-- ---------- delete_account_prepare: service role only ----------
create or replace function public.delete_account_prepare(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  heir uuid;
  host_nullable boolean;
begin
  if p_user is null then raise exception 'No user.'; end if;
  perform set_config('parcade.account_delete', '1', true);
  perform set_config('parcade.tn', '1', true);   -- trusted for the tournament triggers

  -- 1. Their spots in rounds stay for everyone else, anonymized
  update players set name = 'Deleted player', user_id = null where user_id = p_user;

  -- 2. Rounds they host
  select not attnotnull into host_nullable from pg_attribute
    where attrelid = 'public.rounds'::regclass and attname = 'host_id' and not attisdropped;
  for r in select id from rounds where host_id = p_user loop
    heir := (select pl.user_id from players pl where pl.round_id = r.id and pl.user_id is not null limit 1);
    if heir is not null then
      update rounds set host_id = heir where id = r.id;
    elsif coalesce(host_nullable, false) then
      update rounds set host_id = null where id = r.id;
    else
      -- Nobody else with an account in it: same children as delete_round
      delete from season_entries    where round_id = r.id;
      delete from season_rounds     where round_id = r.id;
      delete from player_mulligans  where round_id = r.id;
      delete from mulligans         where round_id = r.id;
      delete from predictions       where round_id = r.id;
      delete from caddy_pairs       where round_id = r.id;
      delete from wolf_picks        where round_id = r.id;
      delete from wads              where round_id = r.id;
      delete from bets              where round_id = r.id;
      delete from messages          where round_id = r.id;
      delete from challenge_results where round_id = r.id;
      delete from scores            where round_id = r.id;
      delete from players           where round_id = r.id;
      delete from rounds            where id = r.id;
    end if;
  end loop;

  -- 3. Seasons they own
  for r in select id from seasons where owner_id = p_user loop
    heir := (select m.user_id from season_members m where m.season_id = r.id and m.user_id <> p_user
             order by m.joined_at, m.user_id limit 1);
    if heir is not null then
      update seasons set owner_id = heir where id = r.id;
    else
      delete from season_entries where season_id = r.id;
      delete from season_rounds  where season_id = r.id;
      delete from season_aliases where season_id = r.id;
      delete from season_members where season_id = r.id;
      delete from seasons        where id = r.id;
    end if;
  end loop;

  -- 4. Tournaments they own: hand to a captain, then whoever joined first. Nobody else: cascades with the account.
  for r in select id from tournaments where owner_id = p_user loop
    heir := (select m.user_id from tournament_members m where m.tournament_id = r.id and m.user_id <> p_user
             order by m.is_captain desc, m.joined_at, m.user_id limit 1);
    if heir is not null then
      update tournaments set owner_id = heir where id = r.id;
    end if;
  end loop;

  -- 5. Anything else pointing at auth.users that would block the delete (no action / restrict), or shared rows
  --    (courses) that would otherwise cascade away: clear the column if it can be empty, else remove the row.
  for r in
    select c.conrelid::regclass as tbl, cl.relname as tname, a.attname as col, a.attnotnull as notnull, c.confdeltype as rule
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
      and cl.relnamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
  loop
    if r.rule in ('a', 'r') then
      if r.notnull then execute format('delete from %s where %I = $1', r.tbl, r.col) using p_user;
      else execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using p_user;
      end if;
    elsif r.rule = 'c' and r.tname = 'courses' and not r.notnull then
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using p_user;
    end if;
  end loop;

  perform set_config('parcade.account_delete', '', true);
  perform set_config('parcade.tn', '', true);
end $$;

revoke all on function public.delete_account_prepare(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_prepare(uuid) to service_role;

commit;
