# Brief: In-round game screen redesign (app only)

**App only.** Scope everything to `html.in-app` (CSS under `.in-app`, JS branches on `document.documentElement.classList.contains("in-app")`). The website game screen must stay exactly as it is now.

This is the screen shown once a round is playing: the hole view with its vertical side tabs (Hole 1, Leaderboard, Chat, Bets, Course, Rules), the top buttons (Home, Copy link, Scorekeeper), the round title and subtitle, the hole strip, the hole header, the player chips, the game-mode card and the score pad. Find it in `public/app.js` (the panels/tabs code; search `panels.rules`, "Scorekeeper", "Your score") and its CSS in `public/index.html`. Read it fully first. It covers every game mode, One Device Mode / scorekeeper, mulligans, handicap strokes and the finale.

## Goals
At 375×667 and 430×932, for every game mode and on every hole, the Hole view fits on one screen with **no scrolling**: the hole info at the top and the score pad always reachable at the bottom.

## 1. Bottom tab bar (replaces the vertical side tabs)
- **Placement:** a fixed bar at the bottom, inside the safe area, styled like the home screen's app bar (`.app-nav`): icon above a short label, the active tab in glow color.
- **Tabs:** **Hole · Board · Chat · Bets · More**.
  - Board is the Leaderboard.
  - **More** opens a small sheet with **Course** and **Rules**. Picking one shows that panel exactly as the side tab does today.
  - Hide **Bets** when the round has no money, the same as the side tab today if it's hidden then.
  - Keep any unread/badge indicators the side tabs show today (e.g. chat), as a dot on the icon.
- **Side tabs:** hidden in the app. The panels themselves (leaderboard, chat, bets, course, rules) keep their current content and behavior and fill the space between the top bar and the tab bar, scrolling inside themselves only if they're long.

## 2. Slim top bar (replaces Home / Copy link / Scorekeeper / big title)
- **One row:**
  - **‹ Home** on the left.
  - The round name in small type (about 1.1rem, Bungee, no big glow) in the center, cut off with an ellipsis if long.
  - A **⋯** button on the right, opening a menu with **Copy link** (or Share invite via `navigator.share` when available, as in the room), **Scorekeeper: On/Off** (same logic as today, only shown when it is today), **Sound** (the existing sound controls) and the game summary line ("Skins with handicaps at Pebble Beach Golf Links") as non-tappable text.
- **Hidden in the app during play:** the large h1 round title and the subtitle line.

## 3. Compact hole area
- **Hole strip** (1, 2, 3…, with dots and locks): keep it as is, slightly shorter (about 44px tall).
- **Hole header:** at most 2 lines.
  - Line 1: **Hole 1 · Par 4 · Hdcp 6**.
  - Line 2: the status, smaller and muted ("No score yet · you get 2 strokes", or the entered score).
  - Replaces the big "HOLE 1" block.
- **Player chips** (who you're scoring for): one horizontal row. If there are more chips than fit, that row alone scrolls sideways. Same behavior as today.
- **Game-mode card** (Skins, Party challenge, Wolf choice, Nassau status, Sixes teams, etc.):
  - It compacts to a single row: an emoji or icon, a one-line title ("1 skin on this hole") and an **ⓘ** that opens the longer explanation in a popup.
  - **Interactive cards** must keep their controls visible and usable in the compact form: the Wolf partner pick, Party challenge accept/complete, Bingo Bango Bongo picks, Cart Caddy actions, mulligan use/grant, and any confirm buttons. Cards that need more room may use 2–3 rows, but nothing important moves into a popup.
  - Check **every** mode.

## 4. Score pad pinned at the bottom
- **Placement:** "Your score" + 1–10 + 11+ sit just above the tab bar, always visible, with a minimum 52px tap height and large numbers.
- **11+:** it can go on the same row layout as now, but it must not push anything off screen.
- **Unchanged:** every existing pad behavior (selected state, editing a past hole, locked future holes, scorekeeper entering for others, sounds).

## Fit and consistency
- **Type scale:** same as the recent app work (labels about 1.1rem, body 1rem).
- **Avoid overlaps:** toasts and the after-hole recap cards appear above the tab bar and pad, without overlapping them.
- **Text selection:** stays disabled as already set in the app CSS.
- **Light mode:** must look right too.

## Constraints
- Don't change scoring, realtime sync, permissions, recaps or the finale logic. This is layout and navigation only.
- Don't run git or deploy.

## Done when
- In the app, a full 18-hole round can be played in Stroke, Skins, Party, Wolf, Nassau and Sixes with no scrolling on the Hole view.
- The bottom tabs and the ⋯ menu reach everything the old side tabs and top buttons did.
- The website is unchanged.
