# Brief: Mini-golf rounds

## Goal
Add a third option to the Play Now picker, **Play Mini-golf**. The player enters the course by photo or by hand (pars 1–9). Then they go through the normal round setup with mini-golf-friendly choices, and land in the usual room to add players.

## Where things live
- Play Now picker: `homeButtons()` near the bottom of `public/app.js` (`pickFrom("Let's play", [...])`). The hidden `#play-choices` buttons are in `public/index.html`.
- Round creation: the `#create-round` click handler in `public/app.js` (~line 506). Setup steps are course → players → mode → settings → room.
- Modes: `MODES` (~535), `modeGrid()` (~551), and `MODES_FOR` by group size (~761, used again ~1252).
- Course entry: `parsModal()` and the par arrows (~3751, clamped to 3–6 today), `pickApiCourse()` (~1010, rejects pars outside 3–6), and `saveCourse()`.
- Scorecard scan: `netlify/functions/scan.mjs`. Its prompt is golf-only, it needs 14+ readable pars, and it maps any par outside 3–6 to 4.
- Par-based chat lines: `scoreLine()` (~463) already handles `par < 3`. Check it reads well for par 1–2 holes and for "ace" on a par 2.
- `public/tournaments.js` ~270 has the same 3–6 par check. Leave tournaments alone (no mini-golf tournaments).

## Requirements
1. **Entry.** Add `{ label: "Play Mini-golf", value: "mini" }` as the third choice in the Play Now picker. It starts the create-round flow with a `mini` flag. The existing guest rules for creating a round still apply.
2. **Course step (mini).** Offer only two choices: **Scan the scorecard** and **Enter holes manually**. There's no course search and no handicap or hole-handicap prompts.
   - Ask for a course name (optional; default "Mini-golf"). Allow 9 or 18 holes, matching what normal rounds already support.
   - Pars are 1–9 with par 2 as the default. The par arrows clamp to 1–9 in mini mode only. Real golf keeps 3–6.
   - Scan: add a `mini: true` body flag to `scan.mjs` with a mini-golf prompt. It reads pars 1–9, has no hcp_index or tees, and treats a mini-golf scorecard as valid. Make the readable-pars threshold work for 9-hole cards. Show the same **Is this right?** confirm screen so they can fix pars before continuing.
   - Don't save mini courses into the shared real-golf course list or search. If courses are stored in the DB, add a `kind`/`mini` flag and filter real-golf search to exclude them. Otherwise just keep the pars on the round.
3. **Mark the round** as mini (e.g. `rounds.mini boolean default false`, or a field in the existing round settings JSON, whichever matches how settings are stored now). Give the SQL as a separate file in `supabase/mini-golf.sql`.
4. **Players step:** same as normal.
5. **Mode step:** same `modeGrid`, filtered to mini-friendly modes per group size:
   - Allowed: party, stroke, stableford, skins, match, wolf, bestball, vegas (still respecting the existing group-size rules and `guestModeLock()`).
   - Hidden: **bbb** ("first on the green" doesn't apply), **wad** (every shot is a putt), **caddy** (everyone's playing).
   - Party Mode: check the challenge cards (`CHALLENGES` ~470s). Exclude any that only make sense on a real course (fairways, drives, bunkers, carts, yardage). Add a handful of mini-golf ones if fewer than ~12 remain.
6. **Settings step:** same as normal (One Device Mode, bets/pot, mulligans). Hide or skip anything handicap-based for mini rounds.
7. **Room:** same as normal. Show a small "Mini-golf" tag next to the round name in the room, the scorecard header and Recent rounds.
8. **Scoring:** every place that reads par must work with pars 1–9: recaps, Stableford points, sounds (`Sound.play` ~3276), and the finale. A hole-in-one on a par 1 is still an ace, but don't fire eagle/albatross lines for it.
9. **Coins:** mini rounds count toward `claim_round_coin` the same as normal rounds. Don't change the server logic unless it rejects these rounds.

## Constraints
- Don't change real-golf behavior. All new branches key off the mini flag.
- Match the existing code style, Crabby voice and screen transitions. Short, plain wording.
- Don't run git or deploy. List any SQL that must run before deploying.

## Done when
- Play Now shows three options, and Play Mini-golf works end to end for 9 and 18 holes, by photo and by hand.
- Pars 1–9 save and score correctly, and real-golf courses still clamp to 3–6.
- bbb, wad and caddy don't appear for mini rounds.
- `tests/` still pass.
