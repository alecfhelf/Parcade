# Brief: New game mode, Nassau (app and website)

## The game
Nassau is three match-play bets in one round: the **Front 9**, the **Back 9** and the **Overall 18**.

- **2 players:** a singles match, 1 vs 1.
- **4 players:** a 2 vs 2 team match. Each team's **best ball** counts on every hole. Teams are set in the room the same way Best Ball and Vegas set teams today; reuse that UI.

**Each hole:**
- Lower score wins the hole, using net when the round has handicaps on, the same as Match Play and Best Ball do today.
- A tie halves the hole.

**Each of the 3 matches:**
- Whoever wins more holes in that stretch wins the match, worth **1 point**.
- A tied match gives **½ point** each.
- In 4-player games, both players on a team get the team's points.

**Presses:** an optional setting, **off** by default.
- When **on**: whenever a side goes **2 down** in the current nine's match (front or back), a new **press** match starts automatically on the next hole and runs to the end of that nine.
- A press can itself be pressed when that side goes 2 down in the press.
- Each press is worth 1 point, scored like the others.
- Presses only add their own point and never change the Front, Back or Overall results.

**Final standings:** total points. Tiebreak: holes won over the 18, then total strokes.

**Hole count:** Nassau needs 18 holes. Hide it for 9-hole rounds (9-hole mini-golf cards). If the round is set to start on 10 ("swap the nines"), the "Front" match is the first 9 holes played.

## Where it plugs in
Mirror how Match Play, Best Ball and the new Sixes are built. Read them first.
- **`MODES`** in `public/app.js`: add `nassau: { name: "Nassau", desc: "Three bets in one: front 9, back 9 and the full 18. Match play, so every hole is a fight." }` in the same tone as the others.
- **`MODES_FOR`:** add to the `"2"` and `"4"` lists only, near Match Play. It's allowed in mini-golf for 18-hole cards.
- **Settings step:** a "Presses" switch, shown only when Nassau is picked, default off. Store it the same way other mode settings are stored.
- **Club lock:** a non-stroke mode, so it's Club only through the existing rules. Confirm the server trigger covers it, plus any new setting column if one is added.
- **DB:** if any check constraint lists modes, add `'nassau'` in a new `supabase/nassau.sql`, along with any new column for the presses setting. Tournaments: don't allow it; mark it in `tnModeOff` as "Not for tournaments".
- **Rules (`public/rules.js`):** full rules in the same format, with a short example including a press. The ⓘ button must work.
- **Scoring module:** a new `public/nassau.js` with pure functions, plus `tests/nassau.test.js` covering:
  - singles and team best ball, gross and net,
  - halved holes and matches,
  - presses: auto start at 2 down, a press on a press, and that presses never touch the Overall,
  - swapped nines,
  - tiebreaks.
- **During the round:**
  - The leaderboard/scorecard shows the three match statuses live, golf style: "Front: Alec 2 UP", "Back: All square", "Overall: Sam 1 UP", plus any active presses.
  - The after-hole recap says who won the hole.
  - When a press starts, show a short "Press!" recap with a Crabby line.
  - At the turn (after hole 9), a recap shows the Front 9 result.
- **Finale/results:** the podium is by total points, with a small table: Front, Back, Overall and presses, each with the winner and final status (e.g. "3 & 2", "1 UP", "Halved").
- **Bets/pot:** works with the existing pot/payout presets by final points. If per-mode bet logic exists, follow Match Play. Nassau is classically "$X per bet", so if the existing money settings support a per-point amount, use that for 3 bets plus presses.
- **Coins:** the existing first-time-mode 10-coin bonus applies automatically. Confirm nothing extra is needed.
- **Player count:** exactly 2 or 4 golfers. Block Start with a clear message otherwise, as other team modes do.

## Constraints
- It must work on both the website and the app. Make app-only layout tweaks only if something doesn't fit, scoped to `.in-app`.
- Don't change how other modes score.
- Don't run git or deploy. List any SQL to run.

## Done when
- Nassau appears for 2 and 4 players on 18-hole rounds, and plays and scores front, back, overall and optional presses correctly.
- The live statuses and the results table show.
- The new and existing tests pass.
