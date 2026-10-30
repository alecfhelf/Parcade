-- Nassau bets inside Sixes. Run after sixes.sql and nassau.sql. Safe to run more than once.
--
-- 1. The settings on rounds:
--    sixes_nassau       Nassau bets: each 6-hole set is a Front, Back and Overall bet (off by default)
--    sixes_presses      Presses, only used with Nassau bets (on by default, so it's on as soon as Nassau bets is)
--    sixes_birdie       Birdie bonus (off by default)
--    sixes_second_ball  Second-ball tiebreak (off by default)
-- 2. The Club guard covers them. Sixes itself is already Club only, since the guard rejects every mode but 'stroke' for
--    free accounts. Presses defaults to on, so the settings only count as paid while Nassau bets is on.
--
-- This re-creates rounds_club_guard with everything from club.sql and nassau.sql, so re-run this file after either.

-- 1. Settings --------------------------------------------------------------------------------------------------------

alter table public.rounds add column if not exists sixes_nassau boolean not null default false;
alter table public.rounds add column if not exists sixes_presses boolean not null default true;
alter table public.rounds add column if not exists sixes_birdie boolean not null default false;
alter table public.rounds add column if not exists sixes_second_ball boolean not null default false;

-- 2. Club guard: same as nassau.sql, plus Nassau bets in Sixes --------------------------------------------------------

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
  elsif coalesce(new.sixes_nassau, false) and (ins
     or (new.sixes_nassau, new.sixes_presses, new.sixes_birdie, new.sixes_second_ball)
        is distinct from (old.sixes_nassau, old.sixes_presses, old.sixes_birdie, old.sixes_second_ball)) then
    what := 'Nassau bets';
  elsif coalesce(new.stakes, 'none') <> 'none' and (ins
     or (new.stakes, new.buy_in, new.payouts, new.per_point) is distinct from (old.stakes, old.buy_in, old.payouts, old.per_point)) then
    what := 'playing for money';
  end if;

  if what is not null then
    raise exception 'Club Members only: %.', what using errcode = '42501';
  end if;
  return new;
end $$;
