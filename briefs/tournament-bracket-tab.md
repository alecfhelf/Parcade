# Brief: Tournament bracket gets its own tab with zoom (app and website)

## Goal
On the tournament screen (`public/tournaments.js`, styles in `public/index.html`), the bracket is currently drawn inside the setup/manage view. Move it into its own **Bracket** tab, where it can be seen full size and zoomed and panned.

## Tabs
- **Placement:** add a tab row at the top of the tournament screen, using the existing segmented control styling (`.dress-seg` or whatever the tournament screen already uses).
- **Tabs:** **Setup** (or Overview, whatever fits what's there now) · **Bracket** · any other existing sections that make sense as tabs (e.g. Teams/Players, Schedule). Don't invent new content; only reorganize what exists.
- **Bracket tab:**
  - Shows only if the tournament format has a bracket.
  - Before the bracket is generated, it shows a short note ("The bracket appears once teams are set and the tournament starts").
- **Default tab:**
  - **Setup** while the tournament is being set up.
  - **Bracket** once it has started.
  - Remember the last tab for that tournament on the device (`localStorage`, in try/catch).
- **Links:** "Tournament bracket" links (e.g. from the round ⋯ menu, `/?t=CODE`) open straight to the Bracket tab.

## Bracket view
- **Space:** it fills the available screen area under the tabs, without the page scrolling around it.
- **Zoom and pan:**
  - Pinch-zoom and drag-to-pan on touch, plus scroll-wheel/trackpad zoom and drag on desktop.
  - **+ / − / Fit** buttons in a small floating control in the corner.
  - Zoom range is about 0.4× to 2.5×.
  - Implement with a CSS transform on an inner wrapper (`transform: translate(x, y) scale(s)`, `transform-origin: 0 0`) and pointer events. Don't use page zoom; on iOS the app's page zoom stays locked.
- **Fit:** by default the whole bracket fits inside the view. Tapping a round heading (the existing `jumpToRound`) zooms and pans to that round.
- **Keep working:** everything that works in the bracket today (clicking a match to open it, team names, scores, winners advancing, the round heads). Taps must still register as taps after a drag; only treat a pointer movement over ~6px as a pan.
- **Sizes:** must handle every supported bracket size up to 64 teams, and both schedule types.
- **Themes:** looks right in light and dark mode.

## App
In the app (`html.in-app`), the Bracket tab fills the screen between the top bar and the bottom safe area, with no page scroll.

## Constraints
- Don't change tournament logic, data or SQL.
- Don't run git or deploy.

## Done when
- On the website and in the app, the tournament screen has tabs, and the Bracket tab shows the bracket full size with working pinch/drag/wheel zoom, +/−/Fit, round jumping and clickable matches.
- The setup tab no longer contains the bracket.
