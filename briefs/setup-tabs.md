# Brief: Round setup step tabs + compact room (app only)

**App only.** Scope everything to `html.in-app` (CSS under `.in-app`, JS branches on `document.documentElement.classList.contains("in-app")`). The website setup flow must stay exactly as it is now.

The setup flow is the lobby in `public/app.js`:
- **Steps** come from `lobby.dataset.step` and `setStep()`: course, confirm, size (players), mode (game), setup (settings), then the room.
- **Mini-golf** rounds follow the same flow.
- **Earlier app-only CSS** for these steps is near the end of `public/index.html` (search for `.in-app .lobby`). Keep it consistent, and remove rules this change makes obsolete.

## 1. Step tabs
- **Placement:** a single row of tabs directly under the round name and code, visible on every setup step and in the room before the round starts.
- **Tabs:** Course · Players · Game · Settings · Room.
  - The "confirm" step belongs to the Course tab.
  - For a mini-golf round, Course reads "Card".
- **Tab states:**
  - The **current** step is highlighted, using the selected style of the app's other tabs/segmented controls.
  - **Finished** steps show a ✓ and a tiny value under the label: the course name (shortened), "4 players", the mode name, "Settings ✓", "3 in" for the room.
  - **Not reached** steps are dimmed and not tappable.
- **Tapping a tab:**
  - Tapping a finished tab jumps to that step through the existing `setStep()` path, so all the current rules apply: host only, nothing changes once the round has started, and the same validation as the existing "Change game" / "Change settings" / "Change player count" links.
  - Non-hosts see the tabs read-only, as status only.
- **Removed:** the "Change game", "Change settings" and "Change player count" links and the "Skins, 2 players, Pebble Beach…" summary line, since the tabs replace them.
- **Fit:** the tabs must fit at 375px wide with no horizontal scroll. Use short labels and small type, about 0.8rem for labels and 0.7rem for values; values can be cut off with an ellipsis.

## 2. Room: invite
- **One button:** replace the link input + Copy + "Share invite link" with a single **Invite friends** button.
  - It uses `navigator.share({ title, text, url })` when available; inside the Capacitor app that opens the iOS share sheet.
  - Otherwise it falls back to copying the link, with a toast "Link copied".
- **Round code:** stays visible at the top as it is now.
- **One Device Mode:** the existing behavior for adding names stays.

## 3. Room: player list
- **One compact row per player:** sprite · name · small 👑 for the party leader (replacing "(party leader)") · "(you)" · the Club badge as a small ⭐ chip · handicap as "Hcp 28 ✎" (tappable, opening the same edit as today).
- **Removed:** the "Plays straight up" line and any other per-player sub-lines in the app. Keep anything functional, such as team or role pickers for team modes; make those compact too.
- **"+ Add a player":** directly under the list.

## 4. Crabby and Start
- **Crabby:** the same compact size used on the other app steps (`.cd-stage` zoom 0.7, bubble 1rem).
- **Start button:** "Start game" / "Waiting for 1 more" is **pinned to the bottom** of the screen, inside the safe area, so it's always visible. "Delete this round" sits just above it as a small link, or moves into a ⋯ menu next to Home, whichever fits better.

## Fit and consistency
- **No scrolling:** in the room with up to 5 players, and on every setup step, at 375×667 and 430×932, with nothing cut off. Groups of 6 or more may scroll the player list only; the tabs and the Start button stay fixed.
- **Type:** use the same type scale as the recent app CSS: bubble 1rem, headings 1.2rem, row labels about 1.12rem.

## Constraints
- Don't change round logic, permissions or data.
- Don't run git or deploy.

## Done when
- In the app, every setup step shows the tabs and jumping between finished steps works for the host.
- The room fits on one screen with Invite friends, compact player rows and a pinned Start button.
- The website is unchanged.
