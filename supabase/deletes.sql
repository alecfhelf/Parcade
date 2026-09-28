-- Parcade: Delete season / Delete round
-- Paste into the Supabase SQL Editor and run. Safe to run more than once (create or replace).
-- Children are deleted explicitly instead of relying on FK cascades.

begin;

-- ---------- delete_season: owner only. Never deletes rounds. ----------
create or replace function public.delete_season(p_season uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from seasons where id = p_season and owner_id = auth.uid()) then
    raise exception 'Only the season owner can delete this season.';
  end if;
  delete from season_entries where season_id = p_season;
  delete from season_rounds  where season_id = p_season;
  delete from season_aliases where season_id = p_season;
  delete from season_members where season_id = p_season;
  delete from seasons        where id = p_season;
end $$;

-- ---------- delete_round: host only. Never deletes courses. ----------
create or replace function public.delete_round(p_round uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rounds where id = p_round and host_id = auth.uid()) then
    raise exception 'Only the host can delete this round.';
  end if;
  delete from season_entries    where round_id = p_round;
  delete from season_rounds     where round_id = p_round;
  delete from player_mulligans  where round_id = p_round;
  delete from mulligans         where round_id = p_round;
  delete from predictions       where round_id = p_round;
  delete from caddy_pairs       where round_id = p_round;
  delete from wolf_picks        where round_id = p_round;
  delete from wads              where round_id = p_round;
  delete from bets              where round_id = p_round;
  delete from messages          where round_id = p_round;
  delete from challenge_results where round_id = p_round;
  delete from scores            where round_id = p_round;
  delete from players           where round_id = p_round;
  delete from rounds            where id = p_round;
end $$;

-- ---------- round_season_count: how many seasons include a round (for the confirm popup) ----------
-- Security definer so the host sees seasons they aren't a member of. Host only.
create or replace function public.round_season_count(p_round uuid) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from rounds where id = p_round and host_id = auth.uid()) then
    return 0;
  end if;
  return (select count(distinct season_id) from (
    select season_id from season_rounds  where round_id = p_round
    union
    select season_id from season_entries where round_id = p_round
  ) s);
end $$;

revoke all on function public.delete_season(uuid) from public, anon;
revoke all on function public.delete_round(uuid) from public, anon;
revoke all on function public.round_season_count(uuid) from public, anon;
grant execute on function public.delete_season(uuid) to authenticated;
grant execute on function public.delete_round(uuid) to authenticated;
grant execute on function public.round_season_count(uuid) to authenticated;

commit;
