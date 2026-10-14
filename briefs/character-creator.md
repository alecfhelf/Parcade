# Parcade: Character creator (brief for Claude Code)

## Context
Parcade (parcade.golf): plain HTML/JS, no build step, Netlify, Supabase. Client code in public/.
Read first: public/app.js (figureEl, PALETTE, the colors field in ask(), openProfile, the profile menu IIFE at the
end, createRound/join flows, renderAccount, saveMyHandicap/myHandicap for how account data is stored),
public/scorecard.js (podiumFigure), public/crabby.js, public/intro.js, public/seasons.js, public/tournaments.js,
public/index.html (CSS, incl. light-mode overrides under :root[data-theme="light"]).

### Hard rules
- Never run git, deploy, or Supabase commands. Put DB changes in supabase/character.sql, safe to run once.
- Vanilla JS, existing CSS classes, mobile-first, Crabby's voice for copy. Must look right in dark AND light mode.
- Accessible: real buttons, aria-labels on icon-only buttons, 44px touch targets.

## 1. Data model (store-ready)
- New file public/outfits.js (no DOM besides SVG strings), loaded before app.js. It holds:
  - OUTFIT_SLOTS = ["color","hat","shirt","pants","shoes","item"]
  - OUTFIT_ITEMS: array of { id, slot, name, rarity ("common"|"rare"|"epic"), price: null, svg(c) }, where svg(c)
    returns SVG markup drawn on the same coordinate system as the stick figure, so layers line up at any size.
  - DEFAULT_OUTFIT = { color: <first PALETTE color>, hat: null, shirt: null, pants: null, shoes: null, item: null }
  - outfitOwned(id, user) -> true for every item now (price null = free). This is the hook the future store uses.
  - normalizeOutfit(o): drops unknown ids and fills defaults, so old or bad data never breaks rendering.
- Starter items (original designs only, no real brands or known characters):
  - Hats (4): bucket hat, flat cap, visor, top hat.
  - Shirts (4): polo, argyle sweater vest, hawaiian shirt, plain tee with a stripe.
  - Pants (4): khakis, plaid golf pants, shorts, knickers with long socks.
  - Shoes (3): spiked golf shoes, two-tone saddle shoes, sneakers.
  - Items (4): driver, putter, flag on a pole, a coffee cup.
  - Color: the existing PALETTE.
- Storage:
  - The account's outfit lives in auth user_metadata.outfit (same pattern as saveMyHandicap). Guests keep theirs in
    localStorage ("parcade-outfit"), copied to the account if they create one.
  - supabase/character.sql: add players.outfit jsonb (nullable). When a player row is created (new round, join,
    One Device Mode adds, tournaments), copy the creator's current outfit onto it and set players.color = outfit.color
    so anything still reading color keeps working. One Device Mode players added by name get the default outfit.
  - Future store (do NOT build now, just leave room): a user_items table and token balance. Note in a code comment
    where outfitOwned() would check it.

## 2. Rendering
- Extend figureEl(color, size) to figureEl(colorOrPlayer, size, outfit?). Keep every existing call working.
  Wherever a player object is available, pass its outfit so the figure shows clothes.
- Layer order: pants, shoes, body, shirt, hat, item (in the right hand).
- At small sizes (under ~22px, like chat and scorecards), draw only the color, hat and item, so figures stay readable.
- Update podiumFigure (results) and the lobby list, chat, leaderboard, scorecards, bracket cards, recap card, and
  intro.js wherever the player's own figure appears. Crabby is NOT customizable.
- Light mode: clothes need enough contrast on light backgrounds; reuse the existing light overrides or add new ones.

## 3. Dressing room
- Entry points: a "Customize character" row in openProfile (Settings) and a "Customize character" link in the
  top-right profile menu. Guests can use it too.
- Full-screen view (not a small modal):
  - Center: a big live preview of the figure (about 240px tall) on a small spotlight/pedestal, plus the player's name.
  - Tabs: Color, Hats, Shirts, Pants, Shoes, Items. On wide screens, tabs run down the left and right sides of the
    figure (three per side). On phones, the tabs become a scrollable row under the figure, with the item grid below.
  - Item grid: tiles showing each item drawn on a mini figure, its name, the selected one highlighted, and a "None"
    tile for every slot except color. Rarity shown as a small badge. Show a lock and "Coming soon" for items where
    outfitOwned() is false (none right now).
  - Buttons: Randomize, Reset, Save, and Back. Leaving with unsaved changes asks to save or discard.
  - Crabby comments when you save (add 3-4 lines to crabby.js).
- Picking a stick figure color in the "Start a new round" popup and the join popup: preselect the saved outfit color,
  and show the full outfit in the swatch preview. Changing the color there only affects that round.

## 4. Done when
- supabase/character.sql written. Outfits save to the account, survive reload, and show for other players in a
  shared round (test with two devices).
- Old rounds and players with no outfit still render normally.
- Everything looks right in dark and light mode, at phone and desktop widths.
- Finish with: files changed, the SQL to run, and a short test checklist.
