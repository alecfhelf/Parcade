-- Parcade: Seasons v2
-- Paste into the Supabase SQL Editor and run once. Existing seasons become 'legacy' and keep working.
-- season_rounds and season_aliases are not touched.

begin;

-- ---------- seasons ----------
alter table public.seasons
  add column if not exists format text,
  add column if not exists rounds_count int,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists ended_at timestamptz;

update public.seasons set format = 'legacy' where format is null;
alter table public.seasons alter column format set default 'rounds';
alter table public.seasons alter column format set not null;
-- Default so an older cached app that inserts only a name still makes a valid season
alter table public.seasons alter column rounds_count set default 5;

alter table public.seasons drop constraint if exists seasons_format_check;
alter table public.seasons add constraint seasons_format_check check (format in ('legacy', 'rounds', 'dates'));
alter table public.seasons drop constraint if exists seasons_v2_shape;
alter table public.seasons add constraint seasons_v2_shape check (
  format = 'legacy'
  or (format = 'rounds' and rounds_count between 1 and 20)
  or (format = 'dates' and rounds_count between 1 and 20
      and starts_at is not null and ends_at is not null and ends_at >= starts_at
      -- start of the start day to end of the end day, at most a year apart (slack for DST)
      and ends_at < starts_at + interval '1 year 2 days')
);
alter table public.seasons drop constraint if exists seasons_v2_ended;
alter table public.seasons add constraint seasons_v2_ended check (ended_at is null or format = 'rounds');

create or replace function public.seasons_v2_guard() returns trigger
language plpgsql as $$
begin
  if new.format is distinct from old.format then
    raise exception 'A season can''t switch formats once it starts.';
  end if;
  return new;
end $$;
drop trigger if exists seasons_v2_guard on public.seasons;
create trigger seasons_v2_guard before update on public.seasons
  for each row execute function public.seasons_v2_guard();

drop policy if exists "seasons v2 owner update" on public.seasons;
create policy "seasons v2 owner update" on public.seasons for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- helpers (security definer so policies don't recurse through RLS) ----------
create or replace function public.sv2_is_member(p_season uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from season_members where season_id = p_season and user_id = auth.uid());
$$;
create or replace function public.sv2_is_owner(p_season uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from seasons where id = p_season and owner_id = auth.uid());
$$;

-- ---------- season_members ----------
alter table public.season_members
  add column if not exists handicap numeric(4,1),
  add column if not exists joined_at timestamptz not null default now();

alter table public.season_members drop constraint if exists season_members_handicap_range;
alter table public.season_members add constraint season_members_handicap_range
  check (handicap is null or handicap between -10 and 54);

-- joined_at is always the server's clock, so nobody can backdate a join to sneak in old rounds
create or replace function public.season_members_v2_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.joined_at := now();
  elsif new.season_id is distinct from old.season_id or new.user_id is distinct from old.user_id
        or new.joined_at is distinct from old.joined_at then
    raise exception 'Only the name and handicap can change here.';
  end if;
  return new;
end $$;
drop trigger if exists season_members_v2_guard on public.season_members;
create trigger season_members_v2_guard before insert or update on public.season_members
  for each row execute function public.season_members_v2_guard();

drop policy if exists "season_members v2 owner update" on public.season_members;
create policy "season_members v2 owner update" on public.season_members for update to authenticated
  using (public.sv2_is_owner(season_id)) with check (public.sv2_is_owner(season_id));
drop policy if exists "season_members v2 self update" on public.season_members;
create policy "season_members v2 self update" on public.season_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- season_entries ----------
create table if not exists public.season_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (season_id, player_id)
);
create index if not exists season_entries_season_idx on public.season_entries (season_id);
create index if not exists season_entries_round_idx on public.season_entries (round_id);

alter table public.season_entries enable row level security;
grant select, insert, delete on public.season_entries to authenticated;

drop policy if exists "season_entries read" on public.season_entries;
create policy "season_entries read" on public.season_entries for select to authenticated
  using (public.sv2_is_member(season_id));
drop policy if exists "season_entries insert own" on public.season_entries;
create policy "season_entries insert own" on public.season_entries for insert to authenticated
  with check (user_id = auth.uid() and public.sv2_is_member(season_id));
drop policy if exists "season_entries delete" on public.season_entries;
create policy "season_entries delete" on public.season_entries for delete to authenticated
  using (user_id = auth.uid() or public.sv2_is_owner(season_id));
-- No update policy: entries are added or removed, never edited.

create or replace function public.season_entries_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s seasons%rowtype;
  m season_members%rowtype;
  r rounds%rowtype;
  p players%rowtype;
  holes int;
  used int;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'You can only add your own rounds.';
  end if;
  select * into s from seasons where id = new.season_id;
  if not found then raise exception 'That season doesn''t exist.'; end if;
  if s.format not in ('rounds', 'dates') then
    raise exception 'This season uses the old rules. The commissioner adds the rounds.';
  end if;
  -- Lock the member row so two quick taps can't both squeeze under the limit
  select * into m from season_members where season_id = s.id and user_id = new.user_id for update;
  if not found then raise exception 'Join this season before adding rounds.'; end if;

  select * into p from players where id = new.player_id;
  if not found or p.user_id is distinct from new.user_id or p.round_id is distinct from new.round_id then
    raise exception 'That''s not your round.';
  end if;
  select * into r from rounds where id = new.round_id;
  if r.status is distinct from 'finished' then raise exception 'That round isn''t finished yet.'; end if;

  select count(distinct hole) into holes from scores
    where round_id = r.id and player_id = p.id and hole between 1 and 18 and strokes > 0;
  if holes < 18 then raise exception 'You need a score on all 18 holes.'; end if;

  if exists (select 1 from season_entries where season_id = s.id and round_id = r.id and user_id = new.user_id) then
    raise exception 'That round is already in this season.';
  end if;

  if s.format = 'rounds' then
    if s.ended_at is not null then raise exception 'This season is over.'; end if;
    if r.created_at <= m.joined_at then raise exception 'Only rounds played after you joined count.'; end if;
    select count(*) into used from season_entries where season_id = s.id and user_id = new.user_id;
    if used >= s.rounds_count then
      raise exception 'You already have % rounds in. That''s the limit.', s.rounds_count;
    end if;
  else
    if r.created_at < s.starts_at or r.created_at > s.ends_at then
      raise exception 'That round wasn''t played during this season.';
    end if;
  end if;

  new.created_at := now();
  return new;
end $$;
drop trigger if exists season_entries_check on public.season_entries;
create trigger season_entries_check before insert on public.season_entries
  for each row execute function public.season_entries_check();

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'season_entries') then
    alter publication supabase_realtime add table public.season_entries;
  end if;
end $$;

-- ---------- courses ----------
alter table public.courses
  add column if not exists yardage int,
  add column if not exists tee_gender text,
  add column if not exists rating_source text;
alter table public.courses drop constraint if exists courses_tee_gender_check;
alter table public.courses add constraint courses_tee_gender_check check (tee_gender in ('M', 'F'));
alter table public.courses drop constraint if exists courses_rating_source_check;
alter table public.courses add constraint courses_rating_source_check
  check (rating_source in ('official', 'tee_estimate', 'yardage'));

-- ---------- course_samples ----------
-- Anonymous numbers only: gross and handicap for each finished 18-hole round at this course,
-- plus how many different players they came from. Everyone saves their own copy of an API
-- course, so copies of the same OpenGolfAPI course and tee (same pars) are pooled.
create or replace function public.course_samples(p_course uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with target as (
    select id, source, external_id, tee_name, pars from courses where id = p_course
  ), same as (
    select c.id from courses c, target t
    where c.id = t.id
       or (t.source = 'api' and c.source = 'api' and c.external_id = t.external_id
           and c.tee_name is not distinct from t.tee_name and c.pars = t.pars)
  ), s as (
    select coalesce(p.user_id::text, p.id::text) as who,
           sum(sc.strokes)::int as gross,
           coalesce(p.hcp, p.usual_score - 72) as hcp
    from rounds r
    join players p on p.round_id = r.id
    join scores sc on sc.round_id = r.id and sc.player_id = p.id
    where r.course_id in (select id from same)
      and r.status = 'finished'
      and p.role is distinct from 'caddy'
      and (p.hcp is not null or p.usual_score is not null)
      and sc.hole between 1 and 18 and sc.strokes > 0
    group by p.id, p.user_id, p.hcp, p.usual_score, r.created_at
    having count(*) = 18 and count(distinct sc.hole) = 18
    order by r.created_at desc
    limit 300
  )
  select jsonb_build_object(
    'samples', coalesce((select jsonb_agg(jsonb_build_object('gross', gross, 'hcp', hcp)) from s), '[]'::jsonb),
    'players', (select count(distinct who) from s)
  );
$$;
revoke all on function public.course_samples(uuid) from public, anon;
grant execute on function public.course_samples(uuid) to authenticated;

commit;
