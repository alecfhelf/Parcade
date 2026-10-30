# Brief: Nassau bets inside Sixes (app and website)

Sixes already exists (`public/sixes.js`, `briefs/sixes.md`). This adds an optional **Nassau bets** setting to it. If Nassau mode (`briefs/nassau.md`, `public/nassau.js`) is already built, reuse its match and press logic. Don't duplicate it.

## Rules (source: Golf Digest's "How to play Sixes", Nassau variation)
With **Nassau bets** on, each 6-hole segment becomes three bets:

| Bet | Holes in the segment | Value |
|---|---|---|
| Front | first 3 holes | 1 point |
| Back | last 3 holes | 1 point |
| Overall | all 6 holes | 1 point |

- **Total:** 3 segments × 3 bets = **9 bets** per 18 holes. For a 9-hole mini-golf card the segments are 3 holes each, so use **Overall only** per segment and hide the Nassau switch.
- **Scoring:** each hole is still team best ball, net when handicaps are on. Winning a bet gives both teammates its point; a tie gives ½ each.
- **Presses** (sub-option, default **on** when Nassau bets is on): when a team goes **2 down** in the current segment's Front or Back, a press starts on the next hole and runs to the end of that 3-hole half. Since a half is only 3 holes, a press can only start on the third hole of a half after going 2 down. Also allow a 2-down press in the 6-hole Overall that runs to the end of the segment. Each press is worth 1 point and never changes the Front, Back or Overall results.
- **Optional extras**, each its own switch and default **off**:
  - **Birdie bonus:** a team that makes a gross birdie on a hole earns +1 point for each teammate (a net birdie doesn't count).
  - **Second-ball tiebreak:** if both teams' best balls tie on a hole, compare each team's other score. Lower wins the hole; if those tie too, it's halved.
- **Without Nassau bets,** Sixes plays exactly as it does now: 1 point per segment.

## Where it plugs in
- **Settings step:** when Sixes is picked, show a "Nassau bets" switch (default off), with Presses (default on), Birdie bonus (off) and Second-ball tiebreak (off) indented under it. They only show when Nassau bets is on. Store them the same way other mode settings are stored.
- **Club lock / server trigger:** cover the new settings the same way other paid settings are covered.
- **SQL:** add any new columns or checks in `supabase/sixes-nassau.sql`.
- **Rules (`public/rules.js`):** add a "Nassau bets" section to the Sixes rules with a short example.
- **`public/sixes.js`:** add the Nassau scoring as pure functions. Extend `tests/sixes.test.js` to cover:
  - front/back/overall per segment,
  - halves,
  - presses (including one that can't start because the half is ending),
  - the birdie bonus,
  - the second-ball tiebreak,
  - 9-hole behavior,
  - net vs gross.
- **During the round:**
  - Live status shows the current segment's three bets, e.g. "Front: Alec & Sam 1 UP · Back: —  · Overall: 1 UP", plus active presses.
  - Show a "Press!" recap with a Crabby line when one starts.
  - The existing "Partners switch!" recap at holes 6 and 12 also summarizes the finished segment's 3 bets.
- **Results:** the podium is by total points, with a 9-row table (3 segments × Front/Back/Overall, plus presses and birdie bonuses) showing the winner and status.
- **Bets/pot:** if the money settings support a per-point amount, each bet, press and birdie is worth that amount, settled by netting each player's points. Otherwise use the existing pot and payout presets by final points.

## Constraints
- Must work on both the website and the app. Make app-only layout tweaks only if needed, scoped to `.in-app`.
- Sixes without Nassau bets must score exactly as before.
- Don't run git or deploy. List any SQL to run.

## Done when
- The Sixes settings show Nassau bets and its options.
- A full round scores all 9 bets, presses and the extras correctly, and the results show them.
- All tests pass.
