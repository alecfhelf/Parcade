-- Nassau game mode. Run after club.sql. Safe to run more than once.
--
-- 1. rounds.nassau_presses: the Presses setting (off by default).
-- 2. Any check on public.rounds that lists the modes gets 'nassau' added (same approach as sixes.sql).
-- 3. The Club guard also covers turning presses on. Nassau itself is already covered, since the guard rejects every
--    mode but 'stroke' for free accounts.
--
-- sixes-nassau.sql re-creates the Club guard with Sixes' Nassau bets added, so re-run it after this file.
--
-- Tournaments stay as they are: tournaments.mode's check (tournaments.sql) leaves Nassau out on purpose.

-- 1. Presses setting ------------------------------------------------------------------------------------------------

alter table public.rounds add column if not exists nassau_presses boolean not null default false;

-- 2. Mode check -----------------------------------------------------------------------------------------------------

do $$
declare
  c record;
  def text;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as d
    from pg_constraint
    where conrelid = 'public.rounds'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%''vegas''%'
      and pg_get_constraintdef(oid) not like '%''nassau''%'
  loop
    def := replace(c.d, '''vegas''::text', '''vegas''::text, ''nassau''::text');
    if def = c.d then
      def := replace(c.d, '''vegas''', '''vegas'', ''nassau''');
    end if;
    execute format('alter table public.rounds drop constraint %I', c.conname);
    execute format('alter table public.rounds add constraint %I %s', c.conname, def);
    raise notice 'Added nassau to %: %', c.conname, def;
  end loop;
end $$;

-- 3. Club guard: same as club.sql, plus presses -----------------------------------------------------------------------

create or replace function public.rounds_club_guard() returns trigger
language plpgsql as $$
declare
  ins boolean := tg_op = 'INSERT';
  started boolean := coalesce(new.status, 'lobby') <> 'lobby';
  what text;
begin
  if public.tn_trusted() then return new; end if;
  if public.is_club_member(coalesce(new.host_id, auth.uid())) then return new; end if;

  -- Tournament rounds take the tournament's mode, which is checked on the tournament
  if new.mode is not null and new.mode <> 'stroke' and started and new.tournament_id is null
     and (ins or new.mode is distinct from old.mode or coalesce(old.status, 'lobby') = 'lobby') then
    what := 'game modes other than Stroke Play';
  elsif new.course_id is not null and (ins or new.course_id is distinct from old.course_id) then
    what := 'courses';
  elsif new.mini_course is not null and (ins or new.mini_course is distinct from old.mini_course) then
    what := 'mini-golf scorecards';
  elsif coalesce(new.handicap, false) and (ins or new.handicap is distinct from old.handicap) then
    what := 'handicaps';
  elsif coalesce(new.mulligans, 0) > 0 and (ins or new.mulligans is distinct from old.mulligans) then
    what := 'mulligans';
  elsif coalesce(new.nassau_presses, false) and (ins or new.nassau_presses is distinct from old.nassau_presses) then
    what := 'presses';
  elsif coalesce(new.stakes, 'none') <> 'none' and (ins
     or (new.stakes, new.buy_in, new.payouts, new.per_point) is distinct from (old.stakes, old.buy_in, old.payouts, old.per_point)) then
    what := 'playing for money';
  end if;

  if what is not null then
    raise exception 'Club Members only: %.', what using errcode = '42501';
  end if;
  return new;
end $$;
