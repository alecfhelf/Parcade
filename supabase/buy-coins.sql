-- Buy coins: Stripe coin bundles credited by the webhook (netlify/functions/stripe-webhook.mjs).
-- Run after supabase/pro-shop.sql. Safe to run again.
-- coin_purchases holds one row per paid Checkout Session, so a replayed webhook can never credit twice.
-- Nobody but the service role can touch it or call credit_coin_purchase; user_coins and coin_ledger stay read-only to users.

create table if not exists public.coin_purchases (
  stripe_session text primary key,     -- the Checkout Session id (cs_...)
  user_id uuid not null references auth.users on delete cascade,
  coins int not null check (coins > 0),
  created_at timestamptz not null default now()
);
create index if not exists coin_purchases_user on public.coin_purchases (user_id, created_at desc);

-- RLS on with no policies: invisible to anon and authenticated
alter table public.coin_purchases enable row level security;
revoke all on public.coin_purchases from public, anon, authenticated;

-- credit_coin_purchase: adds the coins and a ledger row once per session. Returns the new balance,
-- or null when that session was already credited.
create or replace function public.credit_coin_purchase(p_user uuid, p_coins int, p_session text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_bal int;
begin
  if p_user is null then raise exception 'missing user'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'bad coin amount'; end if;
  if coalesce(trim(p_session), '') = '' then raise exception 'missing session'; end if;

  -- The primary key makes a second (or simultaneous) call for the same session a no-op
  insert into public.coin_purchases (stripe_session, user_id, coins) values (p_session, p_user, p_coins)
    on conflict (stripe_session) do nothing;
  if not found then return null; end if;

  insert into public.user_coins (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.user_coins set balance = balance + p_coins, updated_at = now()
    where user_id = p_user returning balance into v_bal;
  insert into public.coin_ledger (user_id, amount, reason) values (p_user, p_coins, 'Bought ' || p_coins || ' coins');
  return v_bal;
end $$;

revoke all on function public.credit_coin_purchase(uuid, int, text) from public, anon, authenticated;
grant execute on function public.credit_coin_purchase(uuid, int, text) to service_role;

-- Check (in the browser console, signed in as a normal account):
--   await db.rpc("credit_coin_purchase", { p_user: (await db.auth.getUser()).data.user.id, p_coins: 150, p_session: "cs_fake" })
--     -> permission denied for function credit_coin_purchase
--   await db.from("coin_purchases").select("*")   -> permission denied (or no rows)
-- Replay check (SQL editor, as postgres): running the same call twice credits once; the second returns null.
--   select public.credit_coin_purchase('<user uuid>', 10, 'cs_test_replay');
--   select public.credit_coin_purchase('<user uuid>', 10, 'cs_test_replay');
