-- Parcade: Tournaments
-- Paste into the Supabase SQL Editor and run once. Uses "if not exists" / "create or replace" where it can.
-- Results are derived in the app from scores. The database stores settings, members, teams, round-1 slots,
-- seeds, links to Parcade rounds, deadlines and creator overrides.

begin;

-- ---------- helpers ----------
-- True for a signed-in account (not an anonymous guest)
create or replace function public.tn_is_account() returns boolean
language sql stable as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

-- The RPCs below set this flag so the guard triggers let their writes through
create or replace function public.tn_trusted() returns boolean
language sql stable as $$
  select coalesce(current_setting('parcade.tn', true), '') = '1';
$$;

create or replace function public.tournament_code() returns text
language plpgsql volatile as $$
declare
  c text;
begin
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into c from generate_series(1, 6);
    exit when not exists (select 1 from public.tournaments where code = c);
  end loop;
  return c;
end $$;

-- ---------- tables ----------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'setup' check (status in ('setup', 'active', 'finished')),
  mode text not null default 'stroke' check (mode in ('party', 'stroke', 'skins', 'match', 'bbb', 'bestball', 'vegas', 'wolf')),
  handicap boolean not null default true,
  team_size int not null default 2 check (team_size between 1 and 4),
  team_count int not null default 4 check (team_count between 4 and 64),
  schedule text not null default 'over_time' check (schedule in ('one_day', 'over_time')),
  holes_per_match int not null default 18 check (holes_per_match in (9, 18)),
  third_place boolean not null default false,
  tiebreak text not null default 'card_off' check (tiebreak in ('card_off', 'playoff')),
  seeding text not null default 'handicap' check (seeding in ('handicap', 'random', 'manual')),
  buy_in numeric(8,2) not null default 0 check (buy_in >= 0 and buy_in <= 10000),
  payouts numeric[],
  course_id uuid references public.courses(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint tournaments_wolf_solo check (mode <> 'wolf' or team_size = 1),
  -- Bingo Bango Bongo awards are handed out inside a group, so both teams have to share one
  constraint tournaments_bbb_shared check (mode <> 'bbb' or (schedule = 'over_time' and team_size <= 2)),
  constraint tournaments_playoff_over_time check (tiebreak = 'card_off' or schedule = 'over_time'),
  -- Dollars for 1st, 2nd and 3rd, same as rounds.payouts. They add up to the pot (buy-in x every player).
  constraint tournaments_payouts_dollars check (
    buy_in = 0 or (array_length(payouts, 1) = 3 and payouts[1] >= 0 and payouts[2] >= 0 and payouts[3] >= 0
    and payouts[1] + payouts[2] + payouts[3] = buy_in * team_count * team_size))
);
alter table public.tournaments alter column code set default public.tournament_code();

-- If an earlier version of this file already ran, payouts were percentages. Switch them to dollars
-- (50/30/20-style rounding: 2nd and 3rd to whole dollars, 1st takes the rest).
alter table public.tournaments drop constraint if exists tournaments_payouts;
alter table public.tournaments alter column payouts drop not null;
alter table public.tournaments alter column payouts drop default;
select set_config('parcade.tn', '1', true);
update public.tournaments set payouts = null where buy_in = 0 and payouts is not null;
update public.tournaments t set payouts = array[
    x.pot - round(x.pot * t.payouts[2] / 100) - round(x.pot * t.payouts[3] / 100),
    round(x.pot * t.payouts[2] / 100), round(x.pot * t.payouts[3] / 100)]
  from (select id, buy_in * team_count * team_size as pot from public.tournaments) x
  where x.id = t.id and t.buy_in > 0 and array_length(t.payouts, 1) = 3
    and t.payouts[1] + t.payouts[2] + t.payouts[3] <> x.pot;
select set_config('parcade.tn', '', true);
alter table public.tournaments drop constraint if exists tournaments_payouts_dollars;
alter table public.tournaments add constraint tournaments_payouts_dollars check (
  buy_in = 0 or (array_length(payouts, 1) = 3 and payouts[1] >= 0 and payouts[2] >= 0 and payouts[3] >= 0
  and payouts[1] + payouts[2] + payouts[3] = buy_in * team_count * team_size));

create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  position int not null,
  name text not null check (char_length(btrim(name)) between 1 and 24),
  seed int,
  color text,
  created_at timestamptz not null default now(),
  unique (tournament_id, position)
);
create index if not exists tournament_teams_t_idx on public.tournament_teams (tournament_id);

create table if not exists public.tournament_members (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  hcp numeric(4,1) check (hcp is null or hcp between -10 and 54),
  usual_score int check (usual_score is null or usual_score between 40 and 200),
  team_id uuid references public.tournament_teams(id) on delete set null,
  is_captain boolean not null default false,
  assigned_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);
create index if not exists tournament_members_team_idx on public.tournament_members (team_id);
create index if not exists tournament_members_user_idx on public.tournament_members (user_id);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_no int not null,
  slot int not null,
  is_third_place boolean not null default false,
  team_a uuid references public.tournament_teams(id) on delete set null,
  team_b uuid references public.tournament_teams(id) on delete set null,
  round_id uuid references public.rounds(id) on delete set null,
  override_winner uuid references public.tournament_teams(id) on delete set null,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, round_no, slot, is_third_place)
);
create index if not exists tournament_matches_t_idx on public.tournament_matches (tournament_id);

alter table public.rounds
  add column if not exists tournament_id uuid references public.tournaments(id) on delete set null,
  add column if not exists tournament_team_id uuid references public.tournament_teams(id) on delete set null,
  add column if not exists tournament_match_id uuid references public.tournament_matches(id) on delete set null,
  -- Lowest usual score in the whole tournament. The app's holeAllowances measures strokes from this.
  add column if not exists hcp_base int;
create index if not exists rounds_tournament_idx on public.rounds (tournament_id);

-- ---------- membership helpers (security definer so policies don't recurse through RLS) ----------
create or replace function public.tn_is_owner(p_t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tournaments where id = p_t and owner_id = auth.uid());
$$;
create or replace function public.tn_is_member(p_t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tournament_members where tournament_id = p_t and user_id = auth.uid())
      or exists (select 1 from tournaments where id = p_t and owner_id = auth.uid());
$$;
create or replace function public.tn_status(p_t uuid) returns text
language sql stable security definer set search_path = public as $$
  select status from tournaments where id = p_t;
$$;
create or replace function public.tn_is_captain(p_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tournament_members where team_id = p_team and user_id = auth.uid() and is_captain);
$$;

-- ---------- tournaments: guard + team rows follow team_count ----------
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
drop trigger if exists tournaments_guard on public.tournaments;
create trigger tournaments_guard before insert or update on public.tournaments
  for each row execute function public.tournaments_guard();

create or replace function public.tournaments_sync_teams() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  colors text[] := array['#5CE1FF','#FF5C7A','#FFD84D','#7CFF6B','#B57BFF','#FF9F43','#FF7AE0','#4D8BFF','#FFFFFF','#3DDBB0'];
begin
  if tg_op = 'UPDATE' and new.team_count = old.team_count then return null; end if;
  insert into tournament_teams (tournament_id, position, name, seed, color)
    select new.id, g, 'Team ' || g, g, colors[1 + (g - 1) % 10]
    from generate_series(1, new.team_count) g
    where not exists (select 1 from tournament_teams where tournament_id = new.id and position = g);
  update tournament_members set team_id = null
    where team_id in (select id from tournament_teams where tournament_id = new.id and position > new.team_count);
  delete from tournament_teams where tournament_id = new.id and position > new.team_count;
  return null;
end $$;
drop trigger if exists tournaments_sync_teams on public.tournaments;
create trigger tournaments_sync_teams after insert or update of team_count on public.tournaments
  for each row execute function public.tournaments_sync_teams();

-- ---------- tournament_members: guard + captains ----------
create or replace function public.tournament_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t tournaments%rowtype;
  n int;
begin
  -- Writes made by our own triggers (captain upkeep, team sync) and RPCs pass straight through
  if pg_trigger_depth() > 1 or public.tn_trusted() then
    if new.team_id is null then new.is_captain := false; end if;
    return new;
  end if;
  select * into t from tournaments where id = new.tournament_id;
  if t.status <> 'setup' then raise exception 'The tournament already started. Members are locked in.'; end if;
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then raise exception 'You can only join as yourself.'; end if;
    new.joined_at := now();
    new.team_id := null;
    new.assigned_at := null;
    new.is_captain := false;
    return new;
  end if;
  if new.tournament_id is distinct from old.tournament_id or new.user_id is distinct from old.user_id
     or new.joined_at is distinct from old.joined_at then
    raise exception 'That can''t change.';
  end if;
  new.is_captain := old.is_captain;
  if new.team_id is distinct from old.team_id then
    if t.owner_id is distinct from auth.uid() then raise exception 'Only the creator builds the teams.'; end if;
    new.assigned_at := case when new.team_id is null then null else clock_timestamp() end;
    if new.team_id is not null then
      if not exists (select 1 from tournament_teams where id = new.team_id and tournament_id = new.tournament_id) then
        raise exception 'That team isn''t in this tournament.';
      end if;
      select count(*) into n from tournament_members where team_id = new.team_id and user_id <> new.user_id;
      if n >= t.team_size then raise exception 'That team is full.'; end if;
    end if;
  else
    new.assigned_at := old.assigned_at;
  end if;
  if new.team_id is null then new.is_captain := false; end if;
  return new;
end $$;
drop trigger if exists tournament_members_guard on public.tournament_members;
create trigger tournament_members_guard before insert or update on public.tournament_members
  for each row execute function public.tournament_members_guard();

-- The first player assigned to a team is its captain
create or replace function public.tournament_members_captains() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  teams uuid[];
begin
  if pg_trigger_depth() > 1 then return null; end if;
  teams := array_remove(array[
    case when tg_op <> 'INSERT' then old.team_id end,
    case when tg_op <> 'DELETE' then new.team_id end], null);
  update tournament_members m set is_captain = (m.user_id = (
      select x.user_id from tournament_members x where x.team_id = m.team_id
      order by x.assigned_at nulls last, x.joined_at, x.user_id limit 1))
    where m.team_id = any(teams);
  if tg_op <> 'DELETE' and new.team_id is null then
    update tournament_members set is_captain = false
      where tournament_id = new.tournament_id and user_id = new.user_id and is_captain;
  end if;
  return null;
end $$;
drop trigger if exists tournament_members_captains on public.tournament_members;
create trigger tournament_members_captains after insert or update or delete on public.tournament_members
  for each row execute function public.tournament_members_captains();

create or replace function public.tournament_members_delete_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or public.tn_trusted() then return old; end if;
  if (select status from tournaments where id = old.tournament_id) <> 'setup' then
    raise exception 'The tournament already started. Members are locked in.';
  end if;
  return old;
end $$;
drop trigger if exists tournament_members_delete_guard on public.tournament_members;
create trigger tournament_members_delete_guard before delete on public.tournament_members
  for each row execute function public.tournament_members_delete_guard();

-- ---------- tournament_teams: guard ----------
create or replace function public.tournament_teams_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t tournaments%rowtype;
begin
  if pg_trigger_depth() > 1 or public.tn_trusted() then return new; end if;
  if new.id is distinct from old.id or new.tournament_id is distinct from old.tournament_id
     or new.position is distinct from old.position then
    raise exception 'That can''t change.';
  end if;
  select * into t from tournaments where id = new.tournament_id;
  if t.owner_id = auth.uid() then
    if t.status <> 'setup' and (new.seed is distinct from old.seed or new.color is distinct from old.color) then
      raise exception 'Seeds are locked once the tournament starts. Swap teams in the bracket instead.';
    end if;
    return new;
  end if;
  -- Captains can rename their own team, nothing else
  if new.seed is distinct from old.seed or new.color is distinct from old.color then
    raise exception 'Only the creator can change seeds.';
  end if;
  return new;
end $$;
drop trigger if exists tournament_teams_guard on public.tournament_teams;
create trigger tournament_teams_guard before update on public.tournament_teams
  for each row execute function public.tournament_teams_guard();

-- ---------- rounds: tournament links only change through the RPCs ----------
create or replace function public.rounds_tournament_guard() returns trigger
language plpgsql as $$
begin
  if public.tn_trusted() then return new; end if;
  if tg_op = 'INSERT' then
    if new.tournament_id is not null or new.tournament_team_id is not null or new.tournament_match_id is not null
       or new.hcp_base is not null then
      raise exception 'Tournament rounds are created by the tournament.';
    end if;
    return new;
  end if;
  if new.tournament_id is distinct from old.tournament_id or new.tournament_team_id is distinct from old.tournament_team_id
     or new.tournament_match_id is distinct from old.tournament_match_id or new.hcp_base is distinct from old.hcp_base then
    raise exception 'Tournament links can''t be changed.';
  end if;
  if old.tournament_id is not null and (new.handicap is distinct from old.handicap or new.course_id is distinct from old.course_id
     or new.mode is distinct from old.mode) then
    raise exception 'Tournament rounds keep the tournament''s settings.';
  end if;
  return new;
end $$;
drop trigger if exists rounds_tournament_guard on public.rounds;
create trigger rounds_tournament_guard before insert or update on public.rounds
  for each row execute function public.rounds_tournament_guard();

-- ---------- RLS ----------
alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_members enable row level security;
alter table public.tournament_matches enable row level security;

grant select, insert, update on public.tournaments to authenticated;
grant select, update on public.tournament_teams to authenticated;
grant select, insert, update, delete on public.tournament_members to authenticated;
grant select on public.tournament_matches to authenticated;

drop policy if exists "tournaments read" on public.tournaments;
create policy "tournaments read" on public.tournaments for select to authenticated
  using (owner_id = auth.uid() or public.tn_is_member(id));
drop policy if exists "tournaments insert" on public.tournaments;
create policy "tournaments insert" on public.tournaments for insert to authenticated
  with check (public.tn_is_account() and owner_id = auth.uid());
drop policy if exists "tournaments owner update" on public.tournaments;
create policy "tournaments owner update" on public.tournaments for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- No delete policy: delete_tournament() does it.

drop policy if exists "tournament_teams read" on public.tournament_teams;
create policy "tournament_teams read" on public.tournament_teams for select to authenticated
  using (public.tn_is_member(tournament_id));
drop policy if exists "tournament_teams update" on public.tournament_teams;
create policy "tournament_teams update" on public.tournament_teams for update to authenticated
  using (public.tn_is_owner(tournament_id) or public.tn_is_captain(id))
  with check (public.tn_is_owner(tournament_id) or public.tn_is_captain(id));

drop policy if exists "tournament_members read" on public.tournament_members;
create policy "tournament_members read" on public.tournament_members for select to authenticated
  using (public.tn_is_member(tournament_id));
drop policy if exists "tournament_members join" on public.tournament_members;
create policy "tournament_members join" on public.tournament_members for insert to authenticated
  with check (public.tn_is_account() and user_id = auth.uid() and public.tn_status(tournament_id) = 'setup');
drop policy if exists "tournament_members update" on public.tournament_members;
create policy "tournament_members update" on public.tournament_members for update to authenticated
  using (user_id = auth.uid() or public.tn_is_owner(tournament_id))
  with check (user_id = auth.uid() or public.tn_is_owner(tournament_id));
drop policy if exists "tournament_members delete" on public.tournament_members;
create policy "tournament_members delete" on public.tournament_members for delete to authenticated
  using ((user_id = auth.uid() and not public.tn_is_owner(tournament_id)) or
         (public.tn_is_owner(tournament_id) and user_id <> auth.uid()));

drop policy if exists "tournament_matches read" on public.tournament_matches;
create policy "tournament_matches read" on public.tournament_matches for select to authenticated
  using (public.tn_is_member(tournament_id));
-- No write policies: the RPCs below build and edit the bracket.

-- ---------- RPCs ----------
-- Preview for the join screen (you can't read a tournament before you're in it)
create or replace function public.tournament_by_code(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'code', t.code, 'name', t.name, 'status', t.status, 'mode', t.mode,
    'team_count', t.team_count, 'team_size', t.team_size, 'schedule', t.schedule, 'handicap', t.handicap,
    'buy_in', t.buy_in, 'members', (select count(*) from tournament_members m where m.tournament_id = t.id))
  from tournaments t where t.code = upper(btrim(p_code));
$$;

-- Parcade round mode for a match round: the tournament's mode when the round's own rules give the same answer
create or replace function public.tn_round_mode(p_mode text, p_size int, p_one_group boolean) returns text
language sql immutable as $$
  select case
    when p_mode in ('party', 'stroke') then p_mode
    when p_mode = 'bbb' and p_one_group then 'bbb'
    when p_mode in ('skins', 'match') and p_size = 1 and p_one_group then p_mode
    when p_mode in ('bestball', 'vegas') and p_size = 2 and p_one_group then p_mode
    else 'stroke' end;
$$;

create or replace function public.start_tournament(p_t uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tournaments%rowtype;
  n_rounds int := 0;
  size int;
  bracket int[] := array[1];
  nxt int[];
  s int;
  i int;
  seed_a int;
  seed_b int;
  bad text;
  v_base int;
  tm record;
  v_round uuid;
  colors text[] := array['#5CE1FF','#FF5C7A','#FFD84D','#7CFF6B','#B57BFF','#FF9F43','#FF7AE0','#4D8BFF'];
begin
  perform set_config('parcade.tn', '1', true);
  select * into t from tournaments where id = p_t for update;
  if not found or t.owner_id is distinct from auth.uid() then raise exception 'Only the creator can start the tournament.'; end if;
  if t.status <> 'setup' then raise exception 'This tournament already started.'; end if;
  if t.schedule = 'one_day' and t.course_id is null then raise exception 'Pick a course. The one-day format needs it.'; end if;

  if (select count(*) from tournament_teams where tournament_id = p_t) <> t.team_count then
    raise exception 'Team count is out of sync. Change it and change it back.';
  end if;
  select string_agg(tt.name, ', ') into bad from tournament_teams tt
    where tt.tournament_id = p_t
      and (select count(*) from tournament_members m where m.team_id = tt.id) <> t.team_size;
  if bad is not null then raise exception 'Every team needs exactly % players. Check %.', t.team_size, bad; end if;
  if t.handicap then
    select string_agg(m.name, ', ') into bad from tournament_members m
      where m.tournament_id = p_t and m.team_id is not null and m.hcp is null and m.usual_score is null;
    if bad is not null then raise exception 'Handicaps are on. Missing a handicap for %.', bad; end if;
  end if;
  if (select count(distinct seed) from tournament_teams where tournament_id = p_t and seed between 1 and t.team_count) <> t.team_count then
    raise exception 'Seeds need to run 1 to % with no repeats.', t.team_count;
  end if;

  -- Bracket size and standard seed order (1 v 16, 8 v 9, ...)
  while (1 << n_rounds) < t.team_count loop n_rounds := n_rounds + 1; end loop;
  size := 1 << n_rounds;
  while array_length(bracket, 1) < size loop
    nxt := array[]::int[];
    foreach s in array bracket loop
      nxt := nxt || s || (array_length(bracket, 1) * 2 + 1 - s);
    end loop;
    bracket := nxt;
  end loop;

  delete from tournament_matches where tournament_id = p_t;
  for i in 0 .. size / 2 - 1 loop
    seed_a := bracket[2 * i + 1];
    seed_b := bracket[2 * i + 2];
    insert into tournament_matches (tournament_id, round_no, slot, team_a, team_b)
    values (p_t, 1, i,
      (select id from tournament_teams where tournament_id = p_t and seed = seed_a),
      case when seed_b > t.team_count then null
           else (select id from tournament_teams where tournament_id = p_t and seed = seed_b) end);
  end loop;
  for s in 2 .. n_rounds loop
    for i in 0 .. (size >> s) - 1 loop
      insert into tournament_matches (tournament_id, round_no, slot) values (p_t, s, i);
    end loop;
  end loop;
  if t.third_place then
    insert into tournament_matches (tournament_id, round_no, slot, is_third_place) values (p_t, n_rounds, 0, true);
  end if;

  -- Handicap strokes are measured from the lowest usual score in the whole tournament
  select min(coalesce(usual_score, round(72 + hcp)::int)) into v_base
    from tournament_members where tournament_id = p_t and team_id is not null;

  -- One day: each team plays its own 18-hole round, already underway
  if t.schedule = 'one_day' then
    for tm in select * from tournament_teams where tournament_id = p_t order by seed loop
      insert into rounds (name, handicap, mode, status, course_id, host_id, tournament_id, tournament_team_id, hcp_base)
      values (left(t.name || ': ' || tm.name, 40), t.handicap, 'stroke', 'playing', t.course_id,
        (select user_id from tournament_members where team_id = tm.id and is_captain limit 1),
        p_t, tm.id, case when t.handicap then v_base end)
      returning id into v_round;
      insert into players (round_id, user_id, name, color, usual_score, hcp, group_no, is_co_leader)
        select v_round, x.user_id, x.name, colors[x.rn], coalesce(x.usual_score, round(72 + x.hcp)::int), x.hcp, 1, x.is_captain
        from (select m.*, row_number() over (order by m.assigned_at, m.user_id) as rn
              from tournament_members m where m.team_id = tm.id) x;
    end loop;
  end if;

  update tournaments set status = 'active', started_at = now() where id = p_t;
end $$;

-- Over time: a captain in the match (or the creator) creates the match's Parcade round
create or replace function public.start_tournament_match(p_match uuid, p_team_a uuid, p_team_b uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  m tournament_matches%rowtype;
  t tournaments%rowtype;
  fa tournament_matches%rowtype;
  fb tournament_matches%rowtype;
  n_rounds int := 0;
  one_group boolean;
  v_base int;
  v_round uuid;
  v_code text;
  colors text[] := array['#5CE1FF','#FF5C7A','#FFD84D','#7CFF6B','#B57BFF','#FF9F43','#FF7AE0','#4D8BFF'];
begin
  perform set_config('parcade.tn', '1', true);
  select * into m from tournament_matches where id = p_match for update;
  if not found then raise exception 'That match doesn''t exist.'; end if;
  select * into t from tournaments where id = m.tournament_id;
  if t.status <> 'active' then raise exception 'The tournament isn''t running.'; end if;
  if t.schedule <> 'over_time' then raise exception 'One-day tournaments already have their rounds.'; end if;
  if m.round_id is not null then
    select code into v_code from rounds where id = m.round_id;
    return v_code;
  end if;
  if p_team_a is null or p_team_b is null or p_team_a = p_team_b then raise exception 'Both teams have to be set first.'; end if;
  if not (t.owner_id = auth.uid() or public.tn_is_captain(p_team_a) or public.tn_is_captain(p_team_b)) then
    raise exception 'Only a captain in this match or the creator can start it.';
  end if;

  while (1 << n_rounds) < t.team_count loop n_rounds := n_rounds + 1; end loop;
  if m.round_no = 1 then
    if m.team_b is null then raise exception 'That''s a bye. Nothing to play.'; end if;
    if not ((p_team_a = m.team_a and p_team_b = m.team_b) or (p_team_a = m.team_b and p_team_b = m.team_a)) then
      raise exception 'Those teams aren''t in this match.';
    end if;
  else
    -- Each team has to come out of the match that feeds this slot
    if m.is_third_place then
      select * into fa from tournament_matches where tournament_id = t.id and round_no = n_rounds - 1 and slot = 0 and not is_third_place;
      select * into fb from tournament_matches where tournament_id = t.id and round_no = n_rounds - 1 and slot = 1 and not is_third_place;
    else
      select * into fa from tournament_matches where tournament_id = t.id and round_no = m.round_no - 1 and slot = 2 * m.slot and not is_third_place;
      select * into fb from tournament_matches where tournament_id = t.id and round_no = m.round_no - 1 and slot = 2 * m.slot + 1 and not is_third_place;
    end if;
    if not ((p_team_a in (fa.team_a, fa.team_b) and p_team_b in (fb.team_a, fb.team_b))) then
      raise exception 'Those teams didn''t come out of the matches before this one.';
    end if;
    if not m.is_third_place and ((fa.override_winner is not null and fa.override_winner <> p_team_a)
        or (fb.override_winner is not null and fb.override_winner <> p_team_b)) then
      raise exception 'The creator already advanced a different team.';
    end if;
  end if;

  one_group := t.team_size * 2 <= 4;
  select min(coalesce(usual_score, round(72 + hcp)::int)) into v_base
    from tournament_members where tournament_id = t.id and team_id is not null;
  insert into rounds (name, handicap, mode, status, course_id, host_id, tournament_id, tournament_match_id, hcp_base)
  values (left(t.name || ': ' || (select name from tournament_teams where id = p_team_a) || ' v ' ||
      (select name from tournament_teams where id = p_team_b), 40),
    t.handicap, public.tn_round_mode(t.mode, t.team_size, one_group), 'playing', t.course_id, auth.uid(),
    t.id, m.id, case when t.handicap then v_base end)
  returning id, code into v_round, v_code;
  insert into players (round_id, user_id, name, color, usual_score, hcp, group_no, team, is_co_leader)
    select v_round, y.user_id, y.name, colors[y.rn], coalesce(y.usual_score, round(72 + y.hcp)::int), y.hcp,
      case when one_group then 1 else y.side end, y.side, y.is_captain
    from (select x.*, row_number() over (order by x.side, x.assigned_at, x.user_id) as rn
          from (select mm.*, case when mm.team_id = p_team_a then 1 else 2 end as side
                from tournament_members mm where mm.team_id in (p_team_a, p_team_b)) x) y;
  update tournament_matches set team_a = p_team_a, team_b = p_team_b, round_id = v_round where id = m.id;
  return v_code;
end $$;

-- Swap two teams. Before the start this swaps their seeds; after, their spots in round-1 matches nobody has started.
create or replace function public.swap_tournament_teams(p_t uuid, p_team1 uuid, p_team2 uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tournaments%rowtype;
  m1 tournament_matches%rowtype;
  m2 tournament_matches%rowtype;
  s1 int;
  s2 int;
begin
  perform set_config('parcade.tn', '1', true);
  select * into t from tournaments where id = p_t for update;
  if not found or t.owner_id is distinct from auth.uid() then raise exception 'Only the creator can edit the bracket.'; end if;
  if p_team1 = p_team2 then return; end if;
  if (select count(*) from tournament_teams where tournament_id = p_t and id in (p_team1, p_team2)) <> 2 then
    raise exception 'Those teams aren''t in this tournament.';
  end if;
  if t.status = 'setup' then
    select seed into s1 from tournament_teams where id = p_team1;
    select seed into s2 from tournament_teams where id = p_team2;
    update tournament_teams set seed = s2 where id = p_team1;
    update tournament_teams set seed = s1 where id = p_team2;
    update tournaments set seeding = 'manual' where id = p_t;
    return;
  end if;
  if t.status <> 'active' then raise exception 'The tournament is over.'; end if;
  select * into m1 from tournament_matches where tournament_id = p_t and round_no = 1 and p_team1 in (team_a, team_b);
  select * into m2 from tournament_matches where tournament_id = p_t and round_no = 1 and p_team2 in (team_a, team_b);
  if m1.id is null or m2.id is null then raise exception 'Couldn''t find those teams in the first round.'; end if;
  if m1.round_id is not null or m2.round_id is not null or m1.override_winner is not null or m2.override_winner is not null then
    raise exception 'One of those matches already started.';
  end if;
  if t.schedule = 'one_day' and exists (
      select 1 from scores sc join rounds r on r.id = sc.round_id
      where r.tournament_id = p_t and sc.strokes > 0
        and r.tournament_team_id in (m1.team_a, m1.team_b, m2.team_a, m2.team_b)) then
    raise exception 'One of those teams already has scores in. That match has started.';
  end if;
  update tournament_matches set
    team_a = case when team_a = p_team1 then p_team2 when team_a = p_team2 then p_team1 else team_a end,
    team_b = case when team_b = p_team1 then p_team2 when team_b = p_team2 then p_team1 else team_b end
    where id in (m1.id, m2.id);
end $$;

-- Creator advances a team (deadline passed, playoff hole, or a correction). p_winner null clears it.
create or replace function public.set_match_override(p_match uuid, p_winner uuid, p_team_a uuid, p_team_b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m tournament_matches%rowtype;
  t tournaments%rowtype;
begin
  perform set_config('parcade.tn', '1', true);
  select * into m from tournament_matches where id = p_match for update;
  if not found then raise exception 'That match doesn''t exist.'; end if;
  select * into t from tournaments where id = m.tournament_id;
  if t.owner_id is distinct from auth.uid() then raise exception 'Only the creator can advance a team.'; end if;
  if t.status <> 'active' then raise exception 'The tournament isn''t running.'; end if;
  if p_winner is null then
    update tournament_matches set override_winner = null where id = m.id;
    return;
  end if;
  if p_winner not in (p_team_a, p_team_b) then raise exception 'The winner has to be one of the two teams.'; end if;
  if (select count(*) from tournament_teams where tournament_id = t.id and id in (p_team_a, p_team_b)) <> 2 then
    raise exception 'Those teams aren''t in this tournament.';
  end if;
  if m.round_no = 1 and not m.is_third_place and not (p_team_a in (m.team_a, m.team_b) and p_team_b in (m.team_a, m.team_b)) then
    raise exception 'Those teams aren''t in this match.';
  end if;
  update tournament_matches set override_winner = p_winner,
    team_a = case when round_no = 1 and not is_third_place then team_a else coalesce(team_a, p_team_a) end,
    team_b = case when round_no = 1 and not is_third_place then team_b else coalesce(team_b, p_team_b) end
    where id = m.id;
end $$;

create or replace function public.set_round_deadline(p_t uuid, p_round int, p_deadline timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('parcade.tn', '1', true);
  if not public.tn_is_owner(p_t) then raise exception 'Only the creator sets deadlines.'; end if;
  if public.tn_status(p_t) <> 'active' then raise exception 'The tournament isn''t running.'; end if;
  update tournament_matches set deadline = p_deadline where tournament_id = p_t and round_no = p_round;
end $$;

create or replace function public.end_tournament(p_t uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('parcade.tn', '1', true);
  if not public.tn_is_owner(p_t) then raise exception 'Only the creator can end the tournament.'; end if;
  update tournaments set status = 'finished', finished_at = now() where id = p_t and status = 'active';
  if not found then raise exception 'The tournament isn''t running.'; end if;
end $$;

-- Owner only. Rounds are kept (people's scores and season entries survive) and just unlinked. Never deletes courses.
create or replace function public.delete_tournament(p_t uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('parcade.tn', '1', true);
  if not public.tn_is_owner(p_t) then raise exception 'Only the creator can delete this tournament.'; end if;
  update rounds set tournament_id = null, tournament_team_id = null, tournament_match_id = null where tournament_id = p_t;
  delete from tournament_matches where tournament_id = p_t;
  delete from tournament_members where tournament_id = p_t;
  delete from tournament_teams   where tournament_id = p_t;
  delete from tournaments        where id = p_t;
end $$;

-- delete_round from deletes.sql, plus: rounds in a running tournament can't be deleted
create or replace function public.delete_round(p_round uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rounds where id = p_round and host_id = auth.uid()) then
    raise exception 'Only the host can delete this round.';
  end if;
  if exists (select 1 from rounds r join tournaments t on t.id = r.tournament_id
             where r.id = p_round and t.status <> 'finished') then
    raise exception 'This round is part of a tournament that''s still going.';
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

revoke all on function public.tournament_by_code(text) from public, anon;
revoke all on function public.start_tournament(uuid) from public, anon;
revoke all on function public.start_tournament_match(uuid, uuid, uuid) from public, anon;
revoke all on function public.swap_tournament_teams(uuid, uuid, uuid) from public, anon;
revoke all on function public.set_match_override(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.set_round_deadline(uuid, int, timestamptz) from public, anon;
revoke all on function public.end_tournament(uuid) from public, anon;
revoke all on function public.delete_tournament(uuid) from public, anon;
revoke all on function public.delete_round(uuid) from public, anon;
grant execute on function public.tournament_by_code(text) to authenticated;
grant execute on function public.start_tournament(uuid) to authenticated;
grant execute on function public.start_tournament_match(uuid, uuid, uuid) to authenticated;
grant execute on function public.swap_tournament_teams(uuid, uuid, uuid) to authenticated;
grant execute on function public.set_match_override(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.set_round_deadline(uuid, int, timestamptz) to authenticated;
grant execute on function public.end_tournament(uuid) to authenticated;
grant execute on function public.delete_tournament(uuid) to authenticated;
grant execute on function public.delete_round(uuid) to authenticated;

-- ---------- realtime ----------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['tournaments', 'tournament_teams', 'tournament_members', 'tournament_matches'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

commit;
