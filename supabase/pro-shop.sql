-- Pro Shop: coins, shop items and purchases. Run after character.sql. Safe to run more than once.
--
-- Coins and ownership are server-authoritative. Users can only SELECT their own rows (RLS, no write policies, and
-- write privileges revoked); every change goes through the security definer functions below. shop_items is the only
-- source of prices: the app reads it and never sends one.

-- 1. Tables ---------------------------------------------------------------------------------------------------------

create table if not exists public.shop_items (
  id text primary key,                 -- matches the piece id in public/sprites.js
  slot text not null check (slot in ('hat', 'shirt', 'pants', 'shoes', 'item')),
  rarity text not null check (rarity in ('par', 'birdie', 'eagle', 'albatross')),
  price int not null check (price > 0),
  active boolean not null default true
);

create table if not exists public.user_coins (
  user_id uuid primary key references auth.users on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_items (
  user_id uuid not null references auth.users on delete cascade,
  item_id text not null references public.shop_items,
  acquired_at timestamptz not null default now(),
  source text not null check (source in ('purchase', 'grant')),
  primary key (user_id, item_id)
);

create table if not exists public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  amount int not null,                 -- + earned or granted, - spent or taken away
  reason text not null,
  item_id text references public.shop_items,
  granted_by uuid references auth.users on delete set null,  -- the admin, for admin_grant_coins rows
  created_at timestamptz not null default now()
);
create index if not exists coin_ledger_user on public.coin_ledger (user_id, created_at desc);
create index if not exists coin_ledger_recent on public.coin_ledger (created_at desc);

-- 2. Shop items. Bogey gear is free and isn't listed. Prices: Par 10, Birdie 20, Eagle 50, Albatross 100.
-- Re-running resets slot, rarity and price to these values.

insert into public.shop_items (id, slot, rarity, price) values
  ('trucker',     'hat',   'par',       10),
  ('tam',         'hat',   'birdie',    20),
  ('viking',      'hat',   'eagle',     50),
  ('crown',       'hat',   'albatross', 100),
  ('rugby',       'shirt', 'par',       10),
  ('bowling',     'shirt', 'birdie',    20),
  ('windbreaker', 'shirt', 'eagle',     50),
  ('tux',         'shirt', 'albatross', 100),
  ('cargo',       'pants', 'par',       10),
  ('pastel',      'pants', 'birdie',    20),
  ('flames',      'pants', 'eagle',     50),
  ('disco',       'pants', 'albatross', 100),
  ('hightops',    'shoes', 'par',       10),
  ('wingtips',    'shoes', 'birdie',    20),
  ('lightup',     'shoes', 'eagle',     50),
  ('rocket',      'shoes', 'albatross', 100),
  ('umbrella',    'item',  'par',       10),
  ('chicken',     'item',  'birdie',    20),
  ('laser',       'item',  'eagle',     50),
  ('trophy',      'item',  'albatross', 100)
on conflict (id) do update set slot = excluded.slot, rarity = excluded.rarity, price = excluded.price;

-- 3. Row level security: read-only, own rows only -------------------------------------------------------------------

alter table public.shop_items enable row level security;
alter table public.user_coins enable row level security;
alter table public.user_items enable row level security;
alter table public.coin_ledger enable row level security;

drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select using (true);

drop policy if exists user_coins_own on public.user_coins;
create policy user_coins_own on public.user_coins for select to authenticated using (user_id = auth.uid());

drop policy if exists user_items_own on public.user_items;
create policy user_items_own on public.user_items for select to authenticated using (user_id = auth.uid());

drop policy if exists coin_ledger_own on public.coin_ledger;
create policy coin_ledger_own on public.coin_ledger for select to authenticated using (user_id = auth.uid());

-- No insert/update/delete policies, and no write privileges either (belt and braces)
revoke insert, update, delete, truncate on public.shop_items, public.user_coins, public.user_items, public.coin_ledger
  from anon, authenticated;
grant select on public.shop_items to anon, authenticated;
grant select on public.user_coins, public.user_items, public.coin_ledger to authenticated;

-- 4. Buying ---------------------------------------------------------------------------------------------------------

-- buy_item: signed-in, non-guest accounts only. Locks the coin row so two taps (or two tabs) can't spend the same
-- coins twice; the whole function is one transaction, so a failure leaves nothing half done. Returns the new balance.
create or replace function public.buy_item(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item public.shop_items;
  v_bal int;
  v_short int;
begin
  if v_uid is null or not exists (select 1 from auth.users u where u.id = v_uid and not coalesce(u.is_anonymous, false)) then
    raise exception 'Create an account to buy gear.';
  end if;

  select * into v_item from public.shop_items where id = p_item;
  if not found or not v_item.active then
    raise exception 'That item isn''t for sale.';
  end if;

  insert into public.user_coins (user_id) values (v_uid) on conflict (user_id) do nothing;
  select balance into v_bal from public.user_coins where user_id = v_uid for update;

  if exists (select 1 from public.user_items where user_id = v_uid and item_id = p_item) then
    raise exception 'You already own that.';
  end if;

  if v_bal < v_item.price then
    v_short := v_item.price - v_bal;
    raise exception 'You need % more %.', v_short, case when v_short = 1 then 'coin' else 'coins' end;
  end if;

  update public.user_coins set balance = balance - v_item.price, updated_at = now()
    where user_id = v_uid returning balance into v_bal;
  insert into public.user_items (user_id, item_id, source) values (v_uid, p_item, 'purchase');
  insert into public.coin_ledger (user_id, amount, reason, item_id) values (v_uid, -v_item.price, 'Bought ' || p_item, p_item);
  return v_bal;
end $$;

revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;

-- 5. Admin ----------------------------------------------------------------------------------------------------------

-- Same admin check as admin_stats: app metadata role = admin (app metadata can't be changed by the user)
create or replace function public.is_coin_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.raw_app_meta_data ->> 'role' = 'admin');
$$;
revoke all on function public.is_coin_admin() from public, anon;
grant execute on function public.is_coin_admin() to authenticated;

-- admin_grant_coins: positive gives, negative takes away (never below 0). Returns the account's new balance.
create or replace function public.admin_grant_coins(p_email text, p_amount int, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
  v_bal int;
  v_change int;
begin
  if not public.is_coin_admin() then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Enter an amount other than 0.';
  end if;
  if abs(p_amount) > 100000 then
    raise exception 'That''s too many coins at once.';
  end if;

  select u.id into v_target from auth.users u where lower(u.email) = lower(trim(p_email)) and not coalesce(u.is_anonymous, false);
  if v_target is null then
    raise exception 'No account with that email.';
  end if;

  insert into public.user_coins (user_id) values (v_target) on conflict (user_id) do nothing;
  select balance into v_bal from public.user_coins where user_id = v_target for update;
  v_change := greatest(p_amount, -v_bal);

  if v_change <> 0 then
    update public.user_coins set balance = balance + v_change, updated_at = now()
      where user_id = v_target returning balance into v_bal;
    insert into public.coin_ledger (user_id, amount, reason, granted_by)
      values (v_target, v_change, coalesce(nullif(trim(p_reason), ''), 'Admin grant'), auth.uid());
  end if;
  return v_bal;
end $$;

revoke all on function public.admin_grant_coins(text, int, text) from public, anon;
grant execute on function public.admin_grant_coins(text, int, text) to authenticated;

-- admin_coin_ledger: the most recent ledger rows across all accounts, for the admin page
create or replace function public.admin_coin_ledger(p_limit int default 50)
returns table (created_at timestamptz, email text, amount int, reason text, item_id text, balance int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_coin_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select l.created_at, u.email::text, l.amount, l.reason, l.item_id, c.balance
    from public.coin_ledger l
    join auth.users u on u.id = l.user_id
    left join public.user_coins c on c.user_id = l.user_id
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

revoke all on function public.admin_coin_ledger(int) from public, anon;
grant execute on function public.admin_coin_ledger(int) to authenticated;

-- 6. Outfits only wear owned gear -----------------------------------------------------------------------------------

-- owned_outfit: the outfit with each shop piece the user doesn't own swapped for that slot's default
-- (DEFAULT_OUTFIT in public/sprites.js). A null user (One Device Mode names) owns nothing.
-- Old v1 outfits stored the crown as 'hat-crown', which is slot || '-' || id, so that's checked too.
create or replace function public.owned_outfit(p_user uuid, p_outfit jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb := p_outfit;
  s record;
  defaults constant jsonb := '{"hat": "cap", "shirt": "polo", "pants": "slacks", "shoes": "spikes", "item": "driver"}';
begin
  if v is null or jsonb_typeof(v) <> 'object' then
    return v;
  end if;
  for s in
    select si.id, si.slot from public.shop_items si
    where (v ->> si.slot) in (si.id, si.slot || '-' || si.id)
      and not exists (select 1 from public.user_items ui where ui.user_id = p_user and ui.item_id = si.id)
  loop
    v := jsonb_set(v, array[s.slot], defaults -> s.slot);
  end loop;
  return v;
end $$;

revoke all on function public.owned_outfit(uuid, jsonb) from public, anon, authenticated;

-- Replaces the character.sql version: fills a missing outfit from the account (as before), then strips unowned shop
-- gear from every outfit, including ones the app sends. Runs on insert and whenever the outfit changes.
create or replace function public.players_fill_outfit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if tg_op = 'INSERT' and new.outfit is null and new.user_id is not null then
    select u.raw_user_meta_data -> 'outfit' into v from auth.users u where u.id = new.user_id;
    if v is not null and jsonb_typeof(v) = 'object' then
      new.outfit := case when new.color is not null then v || jsonb_build_object('color', new.color) else v end;
    end if;
  end if;
  new.outfit := public.owned_outfit(new.user_id, new.outfit);
  return new;
end $$;

drop trigger if exists players_fill_outfit on public.players;
create trigger players_fill_outfit before insert or update of outfit on public.players
  for each row execute function public.players_fill_outfit();

-- 7. Grandfather the Crown and Trophy for accounts whose saved outfit already wears them ----------------------------

insert into public.user_items (user_id, item_id, source)
select u.id, 'crown', 'grant' from auth.users u
where u.raw_user_meta_data -> 'outfit' ->> 'hat' in ('crown', 'hat-crown')
on conflict do nothing;

insert into public.user_items (user_id, item_id, source)
select u.id, 'trophy', 'grant' from auth.users u
where u.raw_user_meta_data -> 'outfit' ->> 'item' = 'trophy'
on conflict do nothing;

-- 8. Checks to run from the browser console while signed in (each should fail) --------------------------------------
--   await db.from("user_coins").upsert({ user_id: (await db.auth.getUser()).data.user.id, balance: 9999 })
--     -> permission denied for table user_coins
--   await db.from("user_items").insert({ user_id: (await db.auth.getUser()).data.user.id, item_id: "crown", source: "grant" })
--     -> permission denied for table user_items
--   await db.from("coin_ledger").insert({ user_id: (await db.auth.getUser()).data.user.id, amount: 500, reason: "free" })
--     -> permission denied for table coin_ledger
--   await db.rpc("admin_grant_coins", { p_email: "you@example.com", p_amount: 500, p_reason: "free" })  (non-admin)
--     -> not authorized
--   await db.rpc("buy_item", { p_item: "crown" })  (with fewer than 100 coins)  -> You need N more coins.
