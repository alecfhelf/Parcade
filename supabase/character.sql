-- Character creator: outfits on player rows. Safe to run more than once.

-- 1. Each player row carries the outfit it was created with. Null = plain stick figure (old rows).
alter table public.players add column if not exists outfit jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_outfit_shape') then
    alter table public.players add constraint players_outfit_shape
      check (outfit is null or (jsonb_typeof(outfit) = 'object' and pg_column_size(outfit) < 2048));
  end if;
end $$;

-- 2. Rows created without an outfit (tournament rounds are created by start_tournament and
-- start_tournament_match) get the account's saved outfit from auth user_metadata.outfit.
-- The row keeps the color it was given, so colors stay unique in the round; outfit.color follows it.
-- The app sends its own outfit on create round / join / One Device Mode adds, so this only fills gaps.
create or replace function public.players_fill_outfit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if new.outfit is null and new.user_id is not null then
    select u.raw_user_meta_data -> 'outfit' into v from auth.users u where u.id = new.user_id;
    if v is not null and jsonb_typeof(v) = 'object' then
      new.outfit := case when new.color is not null then v || jsonb_build_object('color', new.color) else v end;
    end if;
  end if;
  -- Future store: strip any item ids the user doesn't own here, e.g.
  --   remove keys whose value isn't in (select item_id from user_items where user_id = new.user_id)
  -- (price-free starter items are always allowed).
  return new;
end $$;

drop trigger if exists players_fill_outfit on public.players;
create trigger players_fill_outfit before insert on public.players
  for each row execute function public.players_fill_outfit();

-- 3. Future store (NOT created yet). Sketch only:
--   create table public.user_items (
--     user_id uuid references auth.users on delete cascade,
--     item_id text not null,              -- matches OUTFIT_ITEMS[].id in public/outfits.js
--     acquired_at timestamptz default now(),
--     primary key (user_id, item_id)
--   );
--   create table public.token_balances (user_id uuid primary key references auth.users on delete cascade, tokens int not null default 0);
-- outfitOwned() in public/outfits.js is the client hook that would read user_items.
