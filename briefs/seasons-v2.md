# Parcade: Seasons v2 (brief for Claude Code)

## Context
Parcade (parcade.golf) is a "Mario Party meets golf" web app. Plain HTML/JS with no build step, Netlify hosting,
Supabase (Postgres + realtime + auth). All client code is in `public/`. Netlify functions are in `netlify/functions/`.

Read these before changing anything: `public/seasons.js`, `public/app.js` (look for `holeAllowances`, `strokesOn`,
`ROUND_RANKS`, `loadRoundRanks`, course loading, `pickFrom`, `ask`, `toast`, `openRound`, `navTo`, `showRecentRounds`),
`public/money.js`, `public/crabby.js` (`crabbyDesk`, `crabbyTour`, `CRABBY_SEASON`), `public/rules.js` (seasons section),
`public/index.html` (all CSS lives here).

### Hard rules
- Never run git, deploy, or Supabase commands. Alec runs those.
- Put all database changes in ONE file, `supabase/seasons_v2.sql`, for Alec to paste into the Supabase SQL Editor.
  It must be safe to run once on the live database, and existing data must survive.
- Match the existing code style: vanilla JS, DOM built with createElement or the existing helpers, no frameworks,
  mobile-first, reuse existing CSS classes (btn-ghost, link-btn, mini, player-list, toggle-row, waiting, detail, modal...).
- All user-facing copy: short, plain, a little funny in Crabby's voice where Crabby talks. No jargon.
- Every table gets RLS. Validate on the server (RLS or triggers), not only in the UI.

## Goal
Seasons let a group of friends compete all year, whether they play together or play their own rounds separately.
Everyone is scored against their own handicap, adjusted for course difficulty, so players of any level can win.

## 1. Season formats
The owner creates a season with:
- **Name**
- **Format**, one of:
  - `rounds`: "Each player counts N rounds" (N = 1 to 20, default 5). A member can add at most N rounds.
  - `dates`: a start and end date (end >= start, at most 1 year apart) plus "Best N rounds count" (1 to 20, default 5).
    Members can add unlimited rounds played inside the window, and their best N by points count.
    Store the window as `starts_at` / `ends_at` timestamptz: the start of the start day and the end of the end day
    in the owner's local time.
- Existing seasons get format `legacy` and keep working exactly as they do today (commissioner adds rounds,
  5/3/1 points, aliases). Do not delete or change `season_rounds` or `season_aliases`.

Invites stay the same (`/?s=CODE` link and join by code). Members need accounts.

**On joining** (the owner joins at creation), ask for a handicap: a number from -10 to 54, or "I don't know my handicap"
which asks for their usual 18-hole score and converts with `handicap = usual - 72`, matching the rest of the app.
Pre-fill from their most recent round's `players.usual_score` if one exists. The owner can edit anyone's starting
handicap later.

**Season status:** `dates` seasons are Upcoming, Active, or Final based on the window. `rounds` seasons are Active until
every member has N rounds, or until the owner taps **End season** (store `ended_at`). Final seasons show a winner banner.

## 2. Adding rounds
From a season page, a member taps **Add a round** and picks from their own finished Parcade rounds:
- Rounds where they have a `players` row with `user_id = auth.uid()` and `rounds.status = 'finished'`.
- The player has scores on all 18 holes (a score of 11 means "11+", use 11).
- `rounds` format: the round was created after the member's `joined_at`, and they have fewer than N entries.
- `dates` format: the round's `created_at` is inside `[starts_at, ends_at]`.
- Not already in this season.
- Show each round's name, date, course and tee, gross score, and a difficulty badge (section 4).
  Ineligible rounds are hidden. If none are eligible, explain why in one line.
- Members can remove their own entries. The owner can remove anyone's.
- Rounds without a course are allowed but score with the Default difficulty (section 4).

Enforce the same eligibility rules server-side with a trigger on the new entries table
(security definer, clear error messages).

## 3. Scoring (put this in a new pure-JS file)
Create `public/seasonscore.js` with NO DOM access, loaded before `seasons.js`. End it with
`if (typeof module !== "undefined") module.exports = {...}` so the functions can be tested with plain Node.

For each member, process their counted rounds oldest first.

**Season handicap (anti-sandbagging):** `h` starts at the member's starting handicap. Each round is scored with the
current `h`, and afterwards `h = h + 0.2 * (roundRating - h)`, rounded to 1 decimal.

**Per round**, with `rating`, `slope` and `pars[18]` from section 4 (pars default to 18 x 4 when there's no course):
1. Course handicap: `ch = round(h * slope / 113 + (rating - sum(pars)))`, minimum 0.
2. Strokes per hole: spread `ch` strokes by the course's `hcp_index` (1 = hardest gets the first stroke, then 2, and
   so on, wrapping around for ch > 18). If there's no `hcp_index`, spread evenly using the same logic as `strokesOn`
   in app.js.
3. Adjusted gross: each hole is capped at `par + 2 + strokes on that hole` (net double bogey). Sum all 18.
4. Round rating: `(adjustedGross - rating) * 113 / slope`, rounded to 1 decimal.
5. Points: `clamp(10 + 2 * (h - roundRating), 0, 30)`, rounded to 1 decimal.

**Head-to-head:** for any round where 2 or more season members each have an entry, compare round ratings (rounded to
1 decimal). Each member gets a win against every member they beat, a loss against every member who beat them, and a tie
otherwise. This is bragging rights only: it never affects points, best-N selection, or tiebreaks.

**Standings:**
- `rounds` format: total points across all entries (up to N). Show "3 of 5 rounds."
- `dates` format: total of each member's best N rounds. Show "Best 5 of 8 rounds."
- Ties break on average points per round, then on best single round.
- Each member row shows: points, rounds progress, current season handicap, best round, and
  "Head-to-head: W-L" (with "-T" only if ties > 0).
  Tapping a member expands their rounds: date, course, gross, adjusted gross, round rating, points,
  who they beat, lost to or tied that round, and the difficulty badge.

**Test cases** (write `tests/seasonscore.test.js`, runnable with `node tests/seasonscore.test.js`):
- Pebble Beach whites: rating 71.7, slope 135, par 72, pars 4,5,4,4,3,5,3,4,4,4,4,3,4,5,4,4,3,5.
  Jake (h 5) shoots 80 with no hole over the cap: round rating 6.9, points 6.1.
  Mike (h 20) shoots 92 with no hole over the cap: round rating 17.0, points 16.0.
- A round with one 11 on a par 4 gets that hole capped.
- The drift updates h in the right order across 3 rounds.
- Head-to-head records, including ties, and that they don't change points.
- Every difficulty fallback in section 4.

## 4. Course difficulty (always produces a number)
Write `resolveDifficulty(course, samples)` in `seasonscore.js`. It returns
`{ rating, slope, source, detail }`, where source is `official`, `estimated`, `learned`, or `default`.

Base rating and slope, using the first source that's available:
1. **Official:** `courses.rating` and `courses.slope` are both present. Source `official`.
2. **Estimated from another tee:** saved at course-pick time (see the saving changes below). If the chosen tee has no
   rating but a sibling tee from the same OpenGolfAPI course does, then
   `est(tee) = official(ref) + formula(tee) - formula(ref)`, using the formulas in step 3. Store it with
   `rating_source = 'tee_estimate'`. Source `estimated`.
3. **Estimated from yardage (USGA approximations):**
   - Men: scratch = yards / 220 + 40.9, bogey = yards / 160 + 50.7, slope = 5.381 x (bogey - scratch)
   - Women: scratch = yards / 180 + 40.1, bogey = yards / 120 + 51.3, slope = 4.24 x (bogey - scratch)
   - Use women's when the tee is marked female. Source `estimated`.
4. **Default:** rating = sum of pars (72 with no course), slope = 113. Source `default`.

Then **learned adjustment** (layered on top of 1 to 4):
- A new Postgres function `course_samples(p_course uuid)` (security definer) returns ONLY anonymous numbers:
  each finished 18-hole round at that course with the player's gross total and handicap
  (`usual_score - 72`, skipping players without one), plus the count of distinct players. No names, no ids.
  Cap it at the most recent 300 samples.
- Residual per sample: `gross - (baseRating + hcp * baseSlope / 113)`. Drop samples with |residual| > 15.
- If there are at least 5 samples from at least 3 players:
  `rating = baseRating + w * mean(residual)` with `w = n / (n + 10)`. Source `learned`,
  detail "Learned from n rounds." Slope is unchanged.

Clamps on every path: rating between par - 6 and par + 8, slope between 55 and 155.

Badges in the UI: "Official", "Estimated", "Learned from n rounds", "Default". Default rounds get a subtle warning
style so the group can spot them.

### Saving changes for course data (app.js + netlify/functions)
- Add `courses.yardage int`, `courses.tee_gender text check (tee_gender in ('M','F'))`, and
  `courses.rating_source text check (rating_source in ('official','tee_estimate','yardage'))`.
- `pickApiCourse`: save the chosen tee's yardage and gender (Female means F, otherwise M). If the chosen tee has no
  rating or slope but a sibling tee does, save the tee estimate. If no tee has ratings but yardage is known,
  leave rating null (the yardage estimate is computed live).
- The scan flow: save the chosen tee's yardage, gender and rating source the same way.
- Manual entry: nothing new is required.
- Keep the existing behavior that other users' hand-entered hole handicaps are not reused.

## 5. Screens
- **Seasons list:** unchanged look. Each season shows its format line ("5 rounds each" or "Oct 1 to Dec 31, best 5")
  and status.
- **Create season:** name, then the format toggle (reuse the toggle/switch styling), then a rounds stepper or date
  inputs plus a best-N stepper, then the owner's handicap.
- **Season page:** header with the format and status, invite link and code, standings (section 3), the
  **Add a round** button, the owner tools (edit handicaps, remove entries, End season for the rounds format),
  and the existing money section computed across all entered rounds (distinct round ids).
- **Crabby:** update `CRABBY_SEASON.tour` and `tourGuest` to explain the new flow in 5 or 6 short lines
  (formats, joining with a handicap, adding your own rounds, scoring vs your own handicap, course difficulty,
  head-to-head record). The tour's Back and Next buttons must keep working.
- **Rules:** rewrite the Seasons section in `rules.js` to match, including a plain-English scoring explanation and the
  Jake and Mike example.
- Legacy seasons render with the existing code path.

## 6. Database summary (all in supabase/seasons_v2.sql)
- `seasons`: add `format` ('legacy','rounds','dates'), `rounds_count int`, `starts_at timestamptz`,
  `ends_at timestamptz`, `ended_at timestamptz`. Set existing rows to 'legacy', and default new rows to 'rounds'.
- `season_members`: add `handicap numeric(4,1)` and `joined_at timestamptz default now()` (backfill existing rows
  with now()). Owner can update `handicap`, members can update their own.
- New `season_entries`: id, season_id, user_id, round_id, player_id, created_at;
  unique (season_id, player_id). RLS: members of the season can read; insert only for yourself through the
  eligibility trigger; delete by yourself or the season owner. Add it to the realtime publication.
- `courses`: the new columns from section 4.
- `course_samples` function, with execute granted to authenticated.

## 7. Done when
- SQL file written. `node tests/seasonscore.test.js` passes.
- A "rounds" season and a "dates" season can each be created, joined, filled with rounds, and scored.
- Ineligible rounds can't be added from the UI or directly through the API.
- Legacy seasons look and behave exactly as before.
- Finish with a short summary for Alec: what changed, the SQL to run, and a manual test checklist.
