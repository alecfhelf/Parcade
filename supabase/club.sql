-- Parcade Club: $6.95/month Stripe subscription. Run after tournaments.sql and mini-golf.sql. Safe to run more than once.
--
-- Only the Stripe webhook (netlify/functions/stripe-webhook.mjs, service role) writes club_subscriptions.
-- is_club_member() is the one source of truth. The triggers below refuse paid round and tournament settings
-- for hosts who aren't members, so the app's locks are only there to be friendly.

begin;

-- 1. Table ----------------------------------------------------------------------------------------------------------

create table if not exists public.club_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.club_subscriptions enable row level security;
revoke all on public.club_subscriptions from anon, authenticated;
grant select on public.club_subscriptions to authenticated;

drop policy if exists "club read own" on public.club_subscriptions;
create policy "club read own" on public.club_subscriptions for select to authenticated
  using (user_id = auth.uid());

-- 2. Membership -----------------------------------------------------------------------------------------------------

-- Canceled-at-period-end members keep access until current_period_end, then it locks again on its own.
create or replace function public.is_club_member(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from club_subscriptions
    where user_id = p_user and status in ('active', 'trialing') and current_period_end > now()
  );
$$;
revoke all on function public.is_club_member(uuid) from public;
grant execute on function public.is_club_member(uuid) to authenticated, anon;

-- Which of these players are members, for the Club Member badge in the round room. Returns only the members.
drop function if exists public.club_members(uuid[]);
create or replace function public.club_members(p_users uuid[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from club_subscriptions
  where user_id = any(p_users[1:100]) and status in ('active', 'trialing') and current_period_end > now();
$$;
revoke all on function public.club_members(uuid[]) from public;
grant execute on function public.club_members(uuid[]) to authenticated, anon;

-- 3. Rounds: paid settings need a Club Member host ------------------------------------------------------------------
-- Inserts are checked in full. Updates only check settings that change, so rounds already underway keep going.
-- A round's mode counts once it leaves the lobby. Tournament rounds are made by the tournament RPCs (tn_trusted),
-- and the tournament's own settings are checked on the tournaments table below.

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
  elsif coalesce(new.stakes, 'none') <> 'none' and (ins
     or (new.stakes, new.buy_in, new.payouts, new.per_point) is distinct from (old.stakes, old.buy_in, old.payouts, old.per_point)) then
    what := 'playing for money';
  end if;

  if what is not null then
    raise exception 'Club Members only: %.', what using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rounds_club_guard on public.rounds;
create trigger rounds_club_guard before insert or update on public.rounds
  for each row execute function public.rounds_club_guard();

-- 4. Side bets: only in rounds a Club Member is hosting -------------------------------------------------------------

create or replace function public.bets_club_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_club_member((select host_id from public.rounds where id = new.round_id)) then
    raise exception 'Club Members only: side bets.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists bets_club_guard on public.bets;
create trigger bets_club_guard before insert on public.bets
  for each row execute function public.bets_club_guard();

-- 5. Tournaments: free accounts get Stroke Play, no course and no buy-in --------------------------------------------

create or replace function public.tournaments_club_guard() returns trigger
language plpgsql as $$
declare
  ins boolean := tg_op = 'INSERT';
  what text;
begin
  if public.tn_trusted() then return new; end if;
  if public.is_club_member(new.owner_id) then return new; end if;

  if new.mode <> 'stroke' and (ins or new.mode is distinct from old.mode) then
    what := 'game modes other than Stroke Play';
  elsif new.course_id is not null and (ins or new.course_id is distinct from old.course_id) then
    what := 'courses';
  elsif new.buy_in > 0 and (ins or (new.buy_in, new.payouts) is distinct from (old.buy_in, old.payouts)) then
    what := 'playing for money';
  end if;

  if what is not null then
    raise exception 'Club Members only: %.', what using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists tournaments_club_guard on public.tournaments;
create trigger tournaments_club_guard before insert or update on public.tournaments
  for each row execute function public.tournaments_club_guard();

-- 6. Admin ----------------------------------------------------------------------------------------------------------
-- Emails of current members, for the Club column and the Club Members card on /admin.
-- Same admin check as admin_stats (is_coin_admin from pro-shop.sql).

create or replace function public.admin_club_members() returns table (email text, status text, current_period_end timestamptz, cancel_at_period_end boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_coin_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select u.email::text, c.status, c.current_period_end, c.cancel_at_period_end
    from club_subscriptions c join auth.users u on u.id = c.user_id
    where c.status in ('active', 'trialing') and c.current_period_end > now()
    order by c.current_period_end;
end $$;
revoke all on function public.admin_club_members() from public, anon;
grant execute on function public.admin_club_members() to authenticated;

commit;
