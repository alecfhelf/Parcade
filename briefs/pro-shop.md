# Parcade: Pro Shop and coins (brief for Claude Code)

## Context
Read first: the character system (public/sprites.js if it exists, otherwise public/outfits.js), openDressingRoom and
the profile menu in public/app.js, public/admin.html, public/crabby.js (Crabby already stands at a PRO SHOP desk on
the home screen), public/index.html (CSS, incl. light mode).

### Hard rules
- Never run git, deploy, or Supabase commands. All DB changes in supabase/pro-shop.sql, safe to run once.
- Coins and purchases are SERVER-AUTHORITATIVE. The browser never sets a balance or a price. Every write goes through
  security definer functions; tables are read-only to users through RLS.
- Vanilla JS, existing styles, Crabby's voice for copy, dark and light mode, phone and desktop.

## 1. Rarity
Replace common/rare/epic/legendary everywhere with golf names and colors:
- Bogey (gray) - starting gear, free and owned by everyone
- Par (green) - 10 coins
- Birdie (blue) - 20 coins
- Eagle (purple) - 50 coins
- Albatross (gold) - 100 coins
All existing items become Bogey, EXCEPT the Crown hat and Trophy item, which move into the shop as Albatross.
Players who already have them equipped keep wearing them (grandfathered: grant ownership in the SQL to anyone whose
saved outfit uses them).

## 2. New shop items (one per rarity, per gear category)
Draw them in the same style and coordinate system as the existing gear, getting more over-the-top as rarity goes up.
Original designs only, no brands or known characters.
- Hats: Par trucker cap, Birdie pom-pom tam, Eagle viking helmet, Albatross crown (existing).
- Shirts: Par rugby stripe, Birdie retro bowling shirt, Eagle neon windbreaker, Albatross gold sequin tux jacket.
- Pants: Par cargo shorts, Birdie pastel plaid, Eagle flame pants, Albatross gold disco bell-bottoms.
- Shoes: Par high-tops, Birdie two-tone wingtips, Eagle light-up sneakers (soles blink), Albatross rocket boots
  (little exhaust flame).
- Items: Par golf umbrella, Birdie rubber chicken, Eagle laser putter (glowing shaft), Albatross trophy (existing).
Any animation must be subtle and respect prefers-reduced-motion. Items must work in every pose and at small sizes.

## 3. Database (supabase/pro-shop.sql)
- shop_items: id text primary key, slot, rarity, price int, active boolean. Seed every shop item. This table is the
  only source of prices. Readable by everyone, writable by nobody (SQL only).
- user_coins: user_id primary key, balance int not null default 0 check (balance >= 0), updated_at.
- user_items: user_id, item_id references shop_items, acquired_at, source ('purchase','grant'); primary key both.
- coin_ledger: id, user_id, amount (+/-), reason, item_id, created_at. Every balance change writes a row.
- RLS: users read only their own user_coins, user_items, coin_ledger. No insert/update/delete policies.
- Functions (security definer, search_path set):
  - buy_item(p_item text): must be a signed-in non-anonymous user; item exists and active; not already owned; lock
    the user's coin row; enough coins; subtract price, insert user_items and a ledger row, all in one transaction.
    Return the new balance. Clear error messages ("You need 30 more coins.").
  - admin_grant_coins(p_email text, p_amount int, p_reason text): only for users whose app metadata role is admin
    (same check as admin_stats). Positive or negative, never below 0. Writes a ledger row.
  - The saved outfit must only use owned items: add a check where outfits are saved (user_metadata can't be checked
    by the DB, so validate in the client AND in the trigger/function that copies an outfit onto players.outfit:
    replace any unowned shop item with the default for that slot).
- Grandfather Crown and Trophy as described above.

## 4. Screens
- Coin balance: a coin icon + number in the dressing room header and in the Pro Shop. Guests see "Create an account
  to earn and spend coins."
- Dressing room: shop items appear in each tab after the Bogey items, sorted by rarity, with their rarity color
  border/badge. Unowned ones show a lock and price. Tapping one previews it on the big character ("try on"), with a
  "Buy for 20 coins" button (or "Get coins" note if short). Saving with an unowned item is blocked with a clear message.
- A "Pro Shop" button in the dressing room opens the shop: Crabby behind the counter (reuse the pro shop desk from
  the home screen) with a few new shopkeeper lines, category tabs, item tiles with rarity, price, owned badge, and a
  live preview of the item on the player's own character. Buying asks to confirm, then plays the coin sound, updates
  the balance and marks it owned, with an "Equip it" button.
- Admin page: a "Give coins" form (email, amount, reason) using admin_grant_coins, and the recent ledger.

## 5. Done when
- SQL written. Buying works, can't go below 0, can't buy twice, can't be faked from the browser console
  (try a direct insert into user_items / update of user_coins and confirm RLS blocks it).
- Unowned items can be previewed but not saved or shown in rounds.
- Finish with: files changed, the SQL to run, how to give yourself coins, and a test checklist.
