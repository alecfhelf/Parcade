# Parcade: Pixel characters (brief for Claude Code)

## Goal
Replace the customizable stick figures with pixel-art golfers that match the arcade theme. The look is final and
already built: briefs/character-lab.html is a working prototype. Port its sprite engine EXACTLY (grid size, offsets,
layer order, palettes, item and pose coordinates, outline, run-length rect output). Do not redesign the art.

Read first: briefs/character-lab.html, public/outfits.js, figureEl and every caller in public/app.js, podiumFigure in
public/scorecard.js, the dressing room code, public/seasons.js, public/tournaments.js, public/index.html (CSS, light mode).

### Hard rules
- Never run git, deploy, or Supabase commands. No new SQL should be needed (players.outfit is jsonb). If one is, write
  supabase/pixel-characters.sql.
- Vanilla JS, no build step. Must look right in dark and light mode, at phone and desktop widths.
- Crabby is NOT part of this. Keep him as he is. Keep the home screen golf-course scene as it is.

## 1. Sprite engine (public/sprites.js, loaded before app.js; replaces the drawing code in outfits.js)
- Port from the prototype: render(outfit, pose) -> SVG string, the SKINS / EYES / HAIRC / CLOTH palettes, and the HAIR,
  FACE, SHIRTS, PANTS, SHOES, HATS, ITEMS lists. Keep shape-rendering: crispEdges.
- Cache rendered SVG strings by outfit + pose (many figures repeat on a leaderboard).
- Keep the store hooks from outfits.js: each item has id, name, rarity (common/rare/epic/legendary), price: null, and
  outfitOwned(id) returns true for everything for now.
- Add three more poses for the results screen, drawn with the same pose structure as idle/cheer:
  - "fist": one arm raised in a fist, other arm down (2nd place). Item stays in the lowered hand.
  - "clap": both hands together in front of the chest (3rd place). No item shown, or tucked under an arm.
  - "slump": head dropped one pixel, arms hanging, shoulders down (dead last).

## 2. Outfit data (v2)
- Shape: { v: 2, skin, eyes, hair, hairColor, face, shirt, shirtColor, pants, pantsColor, shoes, shoeColor,
  hat, hatColor, item }. Same storage as today: auth user_metadata.outfit for accounts, localStorage for guests,
  copied to players.outfit when a player row is created. players.color = shirtColor so older code keeps working.
- normalizeOutfit() migrates v1 outfits: old color -> shirtColor, and map old ids to the closest new ones
  (polo->polo, tee->tee, argyle vest->argyle, hawaiian->hawaii; khakis->slacks with a khaki pantsColor, plaid->plaid,
  shorts->shorts; spiked golf shoes->spikes, saddle shoes->spikes, sneakers->sneakers; bucket->bucket, flat cap->cap,
  visor->visor, top hat->tophat, crown->crown; driver, putter, flag->flag, coffee cup->coffee). Unknown ids fall back
  to defaults. Skin, eyes and hair get the prototype's DEFAULT values.
- Players with no outfit at all (One Device Mode names, old rounds): the prototype's DEFAULT outfit with
  shirtColor = their players.color, so groups stay easy to tell apart.

## 3. Everywhere a player appears
- figureEl(...) draws the pixel character (keep its signature so callers don't break), sized by height with the
  sprite's 22:30 ratio. Update the lobby list, chat, leaderboard, scorecards, recap card, final scores, seasons,
  tournament bracket and match cards, and anything else that shows a player.
- Results podium: 1st uses "cheer" with their own hat and raised item, 2nd "fist", 3rd "clap", dead last "slump"
  (keep the poop emoji). Players with no outfit use DEFAULT plus a crown on 1st, like the current fallback.
- Round setup and join popups: the stick-figure color choice becomes "Shirt color for this round", preselected from
  the saved outfit, with a pixel preview.

## 4. Dressing room
- Rebuild it to match the prototype's wardrobe: tabs Body (skin, eyes), Hair (style, color, facial hair), Shirt,
  Pants, Shoes (each with style tiles + color swatches), Hats (style + color), Items. Big preview on the pedestal with a
  Standing / Winner pose toggle and the 2-frame bob (off for reduced motion). Keep Randomize, Reset, Save, Back and the
  unsaved-changes prompt, and keep the tiles' rarity badges.
- Hair and facial-hair tiles render without the hat so the hair is visible (the prototype does this).

## 5. Done when
- Old saved outfits load as sensible pixel characters, and new ones save and show for other players in a shared round.
- Every screen that showed a stick figure for a player now shows the pixel character, including the 5 podium poses.
- Finish with: files changed, anything you could not convert, and a short test checklist.
