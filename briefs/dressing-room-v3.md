# Brief: Dressing room v3 (icon categories, paged 2×3 grid, no scrolling)

## Goal
Rebuild the layout of `openDressingRoom()` in `public/app.js` (styles in `public/index.html`, `.dress*` rules) so the whole screen fits one phone screen with no scrolling. It has category icons at the top, the character in the middle, and a paged 2×3 item grid at the bottom. Keep all the existing logic: try-on, buying, saving, the leave prompt, owned-only tiles, rarity labels and the Albatross sparkle, guest/Club locks, Randomize/Reset/Save and the Pro Shop button. Only the layout changes.

Apply it everywhere (app and website). On wide screens, center it at max-width ~480px.

## Layout (top to bottom, one screen, `height: 100dvh`, `overflow: hidden`)
1. **Top bar (existing):** Back, "Dressing room", coin badge.
2. **Crabby desk (existing `crabbyDesk`)**, with a new small **×** button at the top right of his speech bubble:
   - × hides Crabby and remembers it on this device (`localStorage`, in try/catch), so he stays hidden next time.
   - While he's hidden, anything he would `say()` (try-on, locked, equipped, saved lines) shows as a `toast()` instead, so no message is lost.
   - Add a small "Show Crabby" option somewhere unobtrusive, e.g. a tiny Crabby icon next to the coin badge, that brings him back.
3. **Category icons:** one row with all 7 categories from `DRESS_TABS` (Body, Hair, Shirt, Pants, Shoes, Hats, Items).
   - Each is an icon (simple inline SVG line icons in the app's style: person, hair/comb, shirt, pants, shoe, cap, golf club) with a tiny label under it.
   - The selected category is highlighted. Keep the existing tab roles and arrow-key handling for accessibility.
   - They must all fit on a 375px-wide phone with no horizontal scroll.
4. **Character stage:**
   - The character preview fills the leftover space and shrinks on short phones.
   - Keep the Standing/Winner toggle and the Pro Shop button, laid out compactly (e.g. a small row under the character).
5. **Sub-tabs (only when a category has more than one group):**
   - A small segmented control per `DRESS_PANELS` group. For example, Hair shows Style · Color · Facial hair, Body shows Skin · Eyes, and Shirt shows Style · Color.
   - Item has one group, so it shows no sub-tabs.
6. **Paged grid (the bottom half):**
   - **Tile groups:** a 2-column × 3-row grid (6 tiles per page) of the same tiles as today, with the same contents, selected state, rarity tag and lock/owned tag.
   - **Controls:** ‹ and › arrow buttons on either side or under the grid, plus a small "2 / 4" page indicator. Swiping left/right on the grid also changes pages.
   - **Arrow state:** disable an arrow at the first or last page. With only one page, hide both.
   - **Starting page:** opening a category or sub-tab jumps to the page holding the currently equipped piece.
   - **Swatch groups (colors):** show the swatches in a compact grid in the same area, with no paging unless they don't fit.
7. **Try-on bar and action bar (existing)** stay pinned at the bottom: Randomize, Reset, Save.

## Fit rules
- Nothing on this screen scrolls, including the page, `.dress-scroll` and the body. Remove the `.dress-scroll` scrolling and size everything with flex so it fits.
- Test at 375×667 (iPhone SE) and 430×932. On the smallest screen the character and tiles shrink; nothing gets cut off or overlaps the action bar.
- Respect `env(safe-area-inset-*)` at the top and bottom.
- The app runs in a Capacitor WebView (`html.in-app`). Check it there too: there must be no rubber-band scroll inside the dressing room.

## Constraints
- Don't change outfit data, saving, shop logic or SQL.
- Keep the existing look: neon style, light/dark theme and the button clip-paths.
- Don't run git or deploy.

## Done when
- All 7 category icons, sub-tabs and paged 2×3 grids work, and arrows and swipe change pages.
- Crabby can be ×'d and stays hidden until he's brought back, and his messages show as toasts while he's hidden.
- There's no scrolling anywhere on the screen, at both test sizes, on web and in the app.
