# Brief: Final results screen fits on one screen (app only)

**App only.** Scope everything to `html.in-app` (CSS under `.in-app`, JS branches on `document.documentElement.classList.contains("in-app")`). The website results screen must stay exactly as it is now.

This is the finale/results screen shown when a round ends, or when someone opens results mid-round with the "Continue round" button. It has the top buttons, the round title + "Final results", Continue round, the podium with pixel characters and poses, Final scores, Payouts, and the mode-specific tables (Nassau Front/Back/Overall, Sixes segments, etc.). Find it in `public/app.js` (search "Final results", "Final scores", "Payouts", "Continue round") with its CSS in `public/index.html`. Read it fully first, including every mode's extra sections.

## Goal
At 375×667 and 430×932, for every game mode, with 2 to 5 players, the results screen fits on one screen with no page scroll. Bigger groups may scroll **only** inside the active section's list.

## Layout (top to bottom)
1. **Slim top bar:** the same as the new in-round top bar (`briefs/game-screen-app.md`). Reuse that code if it's built: ‹ Home, the round name small in the center, and ⋯ with Copy link / Share and Sound. Hide the big h1 and the "Final results" subtitle; the top bar title reads "<Round name> · Results".
2. **Podium, compact:**
   - Keep the pixel characters, poses, speech marks (#@%!) and place labels, but shrink everything: characters about 64px tall, podium blocks about 56px (1st), 44px (2nd) and 36px (3rd).
   - Name + result go under each character on one line ("alec · 2 skins").
   - At most 3 places on the podium, as today.
   - The total podium height is about 200px at most.
3. **Section tabs:** a segmented control right under the podium, showing one section at a time:
   - **Scores:** the Final scores list. Compact rows: place, sprite, name, "(you)", result on the right, gross in parentheses. "Thru N holes" becomes a small muted tag on the same line, or moves under the list once if it's the same for everyone.
   - **Payouts:** only when the round has money. Each player's net (+$20 / −$20) in one row each, the "$10 per skin" note as one muted line, and the "who pays who" lines if they exist today.
   - **Details:** only for modes that have extra tables (Nassau, Sixes with or without Nassau bets, Match play breakdowns, etc.). Show those tables there, compacted.
   - The default tab is **Scores**. Hide tabs with nothing to show; if only one tab is left, hide the control.
   - Each section scrolls inside itself only if it overflows, never the page.
4. **Actions pinned at the bottom:**
   - **Continue round** (when the round isn't finished, as today) as the main button.
   - **Home / Play again** or whatever buttons exist today at the end of results, side by side. If there are more than 2 actions, the extras go in ⋯.
   - Stays inside the safe area and doesn't cover the section content.

## Keep working
- Everything else stays as it is now: the finale animation and sounds, coin rewards and toasts (the daily coin, the first-time-mode bonus), the create-account-to-save prompt for guests, season/tournament links, and any share buttons.
- Light mode looks right.
- Type scale matches the recent app work.

## Constraints
- Don't change scoring, payouts or results logic. This is layout only.
- Don't run git or deploy.

## Done when
- In the app, results for Stroke, Skins (with money), Party, Wolf, Nassau and Sixes with Nassau bets each fit on one screen with 2–5 players.
- The Scores / Payouts / Details tabs work and nothing is cut off.
- The website is unchanged.
