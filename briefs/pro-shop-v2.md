# Brief: Pro Shop paged layout + tile name fix (app only)

**App only.** Scope everything to `html.in-app` (CSS under `.in-app`, JS branches on `document.documentElement.classList.contains("in-app")`). The website must stay exactly as it is now.

## 1. Fix: piece names cut off in the dressing room grid
In the new app dressing room 2×3 grid, tile names are truncated to almost nothing ("·", "|", "Gold seq…") because the rarity tag and sprite squeeze the name.
- Lay out each tile with the sprite on the left and a text column on the right: the **name** (full, wrapping to 2 lines max, no ellipsis on normal names), then the **rarity tag**, then the lock/price or Owned line, stacked.
- The rarity tag must no longer sit absolutely positioned over the name.
- Every current piece name must show in full at 375px wide: Gold sequin tux, Disco bell-bottoms, Two-tone wingtips, Light-up sneakers, Neon windbreaker and the rest. Shrink the sprite or font slightly if needed, but don't cut off names.

## 2. Pro Shop: one screen, no scrolling, paged grid
`openProShop()` in `public/app.js` (styles `.pshop*` in `public/index.html`). In the app it currently scrolls. Rebuild its app layout to match the new dressing room:
- **Whole screen** fits in `100dvh` with `overflow: hidden`, with no scrolling anywhere and safe areas respected.
- **Top bar (existing):** Back, "Pro Shop", coin badge.
- **Crabby desk:**
  - Same **×** behavior as the dressing room. Reuse the same `localStorage` key and the same "Show Crabby" icon, so hiding him in one place hides him in both.
  - While he's hidden, his lines show as toasts.
  - Fix the overlap seen now, where his bubble text is cut off at the top under the header.
- **Category icons:** replace the Hats / Shirts / Pants / Shoes / Items text tabs with the same icon buttons the dressing room uses (shared code, not a copy). The Pro Shop has no Body/Hair categories, so show only these 5.
- **Character preview:** shows the current try-on, with the Standing/Winner toggle and the "Tap an item to try it on." hint. It shrinks on short phones.
- **Paged grid:**
  - The same paged 2×3 grid component as the dressing room (shared code), with ‹ › arrows, a "1 / 2" indicator and swipe left/right.
  - Same tile layout as fix #1. Keep the rarity colors and borders, the lock/price/Owned line and the Albatross sparkle.
  - Opening a category starts on page 1, or on the page with the selected item.
- **Buy / Equip bar (existing):** stays pinned at the bottom.

## Constraints
- Don't change shop logic, prices, buying or SQL.
- Test at 375×667 and 430×932 in the app: nothing cut off or overlapping, and no scroll.
- Don't run git or deploy.

## Done when
- The dressing room and Pro Shop show full piece names.
- The Pro Shop in the app doesn't scroll, pages with arrows and swipe, and Crabby can be ×'d.
- The website looks exactly as before.
