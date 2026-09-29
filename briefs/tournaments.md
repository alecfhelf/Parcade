# Parcade: Tournaments (brief for Claude Code)

## Context
Parcade (parcade.golf) is a "Mario Party meets golf" web app. Plain HTML/JS with no build step, Netlify hosting,
Supabase (Postgres + realtime + auth). Client code is in `public/`.

Read these first: `public/app.js` (rounds, lobby, groups, scorekeeper, `holeAllowances`, `strokesOn`, `ROUND_RANKS`,
course loading, `MODES`, per-mode scoring, `openRound`, `navTo`, `pickFrom`, `ask`, `toast`), `public/seasons.js`
(invites, join by code, account requirement, page navigation, owner tools, delete), `public/money.js` (`settleUp`),
`public/teams.js`, `public/skins.js`, `public/match.js`, `public/crabby.js`, `public/rules.js`, `public/index.html` (CSS).

### Hard rules
- Never run git, deploy, or Supabase commands. Alec runs those.
- Put all database changes in ONE file, `supabase/tournaments.sql`, safe to run once on the live database.
- Match the existing style: vanilla JS, existing CSS classes and helpers, mobile-first, Crabby's voice for copy.
- RLS on every table, with server-side checks for anything that matters.
- Reuse existing scoring code wherever possible. Don't fork a mode's rules.

## 1. Entry points
- A **Tournaments** tab on the home screen next to Seasons, with the same page navigation (no full reloads).
- Create, join by code, and an invite link `/?t=CODE`. Everyone needs an account (same as Seasons).
- On joining, a member enters their handicap, or "I don't know" plus a usual score (`hcp = usual - 72`). Pre-fill
  from their latest round. The creator can edit anyone's handicap until the tournament starts.

## 2. Creator settings (all editable until the tournament starts)
- Name and an optional course (required for the one-day schedule).
- **Teams:** 4 to 64. **Players per team:** 1 to 4.
- **Team building:** manual (drag or tap to assign members), **Randomize**, or **Balance by handicap**
  (snake-draft by handicap so team totals are as even as possible). Team names are editable by the creator or that
  team's captain. The first player assigned is the captain. Show each team's combined handicap.
- **Seeding:** by team handicap (lowest combined = 1 seed), random, or manual.
- **Bracket editing:** the creator can swap any two teams in any match that hasn't started. Byes are given to the top
  seeds when the team count isn't a power of 2, using standard bracket order (1 v 16, 8 v 9, ...).
- **Game mode:** any of party, stroke, skins, match, bbb, bestball, vegas. Wolf only when players per team = 1.
  Cart Caddy and Wad are not available. Explain why in one line each in the picker.
- **Handicaps** on or off. Allowances are relative to the lowest handicap in the WHOLE tournament, so they're
  consistent across matches. Use the course's hole handicaps when known (existing `strokesOn` logic).
- **Schedule:**
  - `one_day`: one 18-hole round, split into bracket segments. R = number of bracket rounds = ceil(log2(teams)).
    Split 18 holes into R contiguous segments, with any extra holes going to the LATER rounds
    (4 teams: 9,9. 8 teams: 6,6,6. 16: 4,4,5,5. 32: 3,3,4,4,4. 64: 3,3,3,3,3,3).
    Each team plays its full 18 holes on its own device, in any group. Match N compares the two teams on that
    segment's holes only.
  - `over_time`: each match is its own Parcade round between the two teams, 9 or 18 holes (creator's choice). An
    optional deadline per bracket round. After a deadline, the creator can advance a team manually.
- **3rd-place match:** optional. In one_day it uses the final's segment.
- **Tiebreak:** `card_off` (default: compare net on the segment's hardest hole by hole handicap, then the next hardest,
  and so on; without hole handicaps, compare from the last hole backward; if still tied, the lower combined team
  handicap wins) or `playoff` (over_time only: the creator enters the winner after a playoff hole).
- **Money:** buy-in per player (0 = no money), payouts as percentages by place (1st, 2nd, 3rd, which must total 100).
  Without a 3rd-place match, the 3rd share is split between the two semifinal losers. Team winnings split evenly
  among teammates. At the end, show "who owes who" using `settleUp` from money.js, plus each person's net.

## 3. Team scoring per mode (team vs team, over the match's holes only)
Use each mode's existing per-player or per-team logic wherever it exists. With handicaps on, everything uses net scores.
- stroke: team total = sum of every player's net strokes. Lower wins.
- bestball: best net per hole per team, summed. Lower wins.
- vegas: standard Vegas between the two teams. With more than 2 players, use each team's best two scores per hole.
  With 1 player, use a straight stroke comparison.
- match: holes won, using each team's best net per hole.
- skins: each hole goes to the team with the best net. Ties carry over within the match. Most skins wins.
- party / bbb: each player's points from the existing mode logic, summed by team. Higher wins.
- wolf (1-player teams only): treat as stroke.
A match is final when both teams have scores for every player on every hole of the match. Ties go to the tiebreak.

## 4. Data and derivation
Prefer DERIVING results from scores when read, instead of storing computed winners.
Store only settings, members, teams, round-1 slots and seeds, links to Parcade rounds, and creator overrides.
Suggested tables (adjust after reading the code):
- `tournaments`: id, code, name, owner_id, status ('setup','active','finished'), mode, handicap, team_size,
  team_count, schedule, holes_per_match, third_place, tiebreak, buy_in, payouts numeric[], course_id, created_at,
  started_at.
- `tournament_members`: tournament_id, user_id, name, hcp numeric(4,1), usual_score, team_id, is_captain, joined_at.
- `tournament_teams`: id, tournament_id, name, seed, color.
- `tournament_matches`: id, tournament_id, round_no, slot, team_a, team_b (round 1 set at start, later rounds filled
  from derived results or overrides), round_id (Parcade round, over_time), override_winner, deadline, is_third_place.
- `rounds`: add a nullable tournament_id, plus a team_id or match_id link. one_day creates one Parcade round per
  team (group = that team). over_time creates one Parcade round per match (two groups, one per team) when a team's
  captain or the creator taps **Start match** after both teams are known.
- Security definer functions: `start_tournament` (validates teams and builds the bracket), `delete_tournament`
  (owner only; deletes children explicitly, and never deletes courses).
- RLS: members read everything in their tournament. The creator writes settings, teams, bracket, and overrides.
  Members update their own handicap before the start. Add the tables to realtime.

## 5. Screens
- **Tournament home:** status, settings summary, invite link and code, member list with handicaps, teams.
- **Bracket:** everyone sees the full bracket, live.
  - Desktop: a horizontal bracket with columns by round.
  - Mobile: round tabs (Round of 64, Round of 32, Sweet 16, Elite 8, Final Four, Championship, using only the rounds
    that exist) with match cards.
  - Highlight the viewer's team and its path. Byes are shown clearly.
  - It has to stay usable at 64 teams (virtualize or collapse rounds if needed).
- **Match detail:** tap any match to see both teams, players, handicaps, strokes received, scorecards for that match's
  holes, live team scores, status, and the tiebreak result if one was used. Visible to every member.
- **My match:** a clear button to go score (one_day: your team's round; over_time: your current match round).
- **Creator tools:** edit teams (manual, randomize, balance), seeding, swap teams in unstarted matches, advance or
  override a result, set deadlines, start, end, and delete the tournament.
- **Results:** podium (reuse the results screen style), payouts, who owes who.
- **Crabby:** a 5–6 line tour with Back and Next, like Seasons.
- **Rules:** a Tournaments section in rules.js.

## 6. Tests
`tests/tournament.test.js`, runnable with `node`. Put the pure logic in `public/tournament-core.js` (no DOM, with a
module.exports guard). Cover bracket generation with byes and seeding order at 4, 6, 8, 12, 16, 33 and 64 teams;
hole segmentation for every team count; team scoring for each mode; card-off tiebreaks; payout splits with and
without a 3rd-place match; and balance-by-handicap evenness.

## 7. Done when
- SQL file written and the tests pass.
- A 4-team one_day tournament and an 8-team over_time tournament can each be created, joined, built, played and
  finished. Any member can see everything.
- The creator can swap teams in unstarted matches, and byes advance automatically.
- Money shows correct payouts and who owes who.
- Finish with a short summary: what changed, the SQL to run, and a manual test checklist.
