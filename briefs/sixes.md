# Brief: New game mode, Sixes (app and website)

## The game
Sixes, also called Round Robin or Hollywood, is a **4-player** game where partners rotate every 6 holes, so everyone partners with everyone once.

**Teams, by player order in the room (A, B, C, D):**

| Holes | Teams |
|---|---|
| 1–6 | A+B vs C+D |
| 7–12 | A+C vs B+D |
| 13–18 | A+D vs B+C |

- For a 9-hole round (mini-golf 9-hole cards), the segments are holes 1–3, 4–6 and 7–9.
- If the round starts on 10 ("swap the nines"), segments follow play order, not hole numbers.

**Each hole:**
- Each team's **best ball** counts, using net scores when the round has handicaps on, exactly like Best Ball mode does today.
- The lower team wins the hole. A tie halves it.

**Each segment (6 holes) is its own little match:**
- The team that wins more holes in the segment wins it, and **each player on that team gets 1 point**.
- A tied segment gives each player **½ point**.

**Final standings:** individual points, with 3 max. Tiebreak: total holes won across all three segments, then total strokes.

## Where it plugs in
Follow how Best Ball / Vegas / Match Play are built. Read them first and mirror their structure.
- **`MODES`** in `public/app.js`: add `sixes: { name: "Sixes", desc: "4 players. Partners rotate every 6 holes, so everyone teams up with everyone. Win the most 6-hole matches." }`. Keep the tone in line with the other descriptions.
- **`MODES_FOR`:** only in the `"4"` list, placed after `bestball`. It's allowed in mini-golf too: don't add it to `MINI_HIDDEN`.
- **Club lock:** it's a non-stroke mode, so it follows the existing tier rules (Club only). Check the server-side trigger in `supabase/club.sql` treats it like other non-stroke modes. It should, since it rejects anything that isn't `stroke`.
- **DB:** if `rounds.mode` (or anything else) has a check constraint listing modes, add `'sixes'` in a new `supabase/sixes.sql`. Tournaments: don't allow Sixes (mark it in `tnModeOff` as "Not for tournaments").
- **Rules (`public/rules.js`):** add full rules in the same format as the others, with a short worked example. The ⓘ button and `showRulesModal` must work.
- **Scoring module:** create a new `public/sixes.js`, like `match.js`/`teams.js`, exporting pure functions. Add tests in `tests/sixes.test.js` in the style of the existing tests, covering:
  - team assignment per segment (18 and 9 holes, normal and swapped nines),
  - hole results with ties,
  - segment points,
  - tiebreaks,
  - net vs gross.
- **During the round:**
  - The scorecard and leaderboard show the current segment's teams (e.g. "Holes 7–12: Alec & Sam vs Jo & Kim") and the segment's live hole tally.
  - The after-hole recap says who won the hole.
  - At holes 6 and 12, show a short "Partners switch!" recap card with the new teams.
  - Add Crabby lines for the switch in the same voice.
- **Finale/results:** the podium is by individual points. The results screen shows a small table of the three segments: teams, holes won, who won.
- **Bets/pot:** works with the existing pot and payout presets, placed by final individual points. If there's per-mode bet logic, follow how Match Play handles it.
- **Coins:** the first time someone plays Sixes they get the existing one-time 10-coin bonus automatically. It's keyed by mode, so confirm nothing extra is needed.
- **Player count:** Sixes needs exactly 4 golfers. If the count changes away from 4 in the room before starting, block Start with a clear message, the same way other team modes handle wrong counts.

## Constraints
- Must work on both the website and the app. Make app-specific layout tweaks only if something doesn't fit, scoped to `.in-app`.
- Don't change how other modes score.
- Don't run git or deploy. List any SQL to run.

## Done when
- Sixes appears for 4 players, plays a full 18 or 9 holes with rotating partners, shows the switches, scores correctly, and finishes with the podium and the segment table.
- The tests pass, including the existing ones.
