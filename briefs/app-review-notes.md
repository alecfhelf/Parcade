# App Review notes and App Store Connect answers

Companion to `briefs/app-store-ready.md`. Paste the notes into App Store Connect > App Review Information > Notes.

## 1. App Review notes (draft)

> Parcade is a scorekeeping app for friendly golf and mini-golf rounds. One person starts a round, friends join with a 6-letter code, and everyone enters scores hole by hole on their own phone. Parcade adds the game formats (Skins, Nassau, Wolf, Sixes, Vegas and more), live leaderboards, chat, a mascot (Crabby) who comments on the round, and a pixel-art character you dress with gear from the Pro Shop.
>
> **Money.** Some formats let a group agree on friendly stakes (for example $1 a skin). Parcade only does the arithmetic and shows who owes whom at the end. It never holds, moves or processes money, has no wallet or payouts, and does not link to any payment or betting service. Players settle up between themselves outside the app.
>
> **Coins.** Coins are a virtual currency earned by finishing rounds and trying new game modes, and spent only on cosmetic character gear in the Pro Shop. They cannot be bought in this version of the app and have no cash value.
>
> **Club membership.** Some features (game modes other than Stroke Play, course lookup, the scorecard scanner, handicaps, mulligans, money tracking) are Club perks. The iOS app does not sell the Club or link to a purchase; it only shows "This is a Club perk". Existing members can open "Club membership" to manage a subscription they already have.
>
> **Demo account.** Email: `________` / Password: `________`. This account is a Club Member (granted free from our admin panel), so every feature is unlocked.
>
> **How to reach every feature**
> - **Start a round:** Home > Play Now > Start a new round. Pick a course (search, Scan a scorecard photo, enter pars, or Skip), the number of players, a game mode and settings, then Start.
> - **Multiplayer:** in the round lobby tap Invite friends (iOS share sheet) or give the code to a second device signed in or as a guest (Home > Play Now > Join with a code). A single device can also keep score for everyone.
> - **Scoring:** tap a number on the score pad for each hole. Hole, Leaderboard, Chat, Bets, Course and Rules tabs are along the bottom. The host taps Finish round to see results (podium, scorecard, payouts).
> - **Mini-golf:** Home > Play Now > Play Mini-golf.
> - **Scorecard scanner:** while setting up a round, Course > Scan a scorecard photo. It uses the camera or photo library and fills in the course.
> - **Seasons:** Home > Seasons. Create a season and add finished rounds; standings update automatically.
> - **Tournaments:** Home > Tournaments. Create one, add teams, start it and follow the bracket.
> - **Character and Pro Shop:** Character in the bottom bar (or tap Crabby's counter on Home). Buy gear with coins; the coin badge > How to earn explains earning.
> - **Recent rounds:** Rounds in the bottom bar.
> - **Profile and settings:** the profile button in the middle of the bottom bar > Edit profile: name, handicap, sound, music, appearance (dark, light, match phone), password, Terms, Privacy, Contact support.
> - **Delete account:** profile > Edit profile > Delete account (bottom). Type DELETE to confirm. Rounds stay for the other players under "Deleted player".
> - **Guests:** everything above except Seasons, Tournaments, Character and profile works without an account.

## 2. App Privacy ("nutrition label") answers

Based on what the code actually sends and stores (Supabase tables and auth metadata, Netlify functions, Stripe). No analytics, ads or third-party tracking SDKs are in the app or the site.

**Do you or your third-party partners use data for tracking?** No. (`NSPrivacyTracking` is false in `ios/App/App/PrivacyInfo.xcprivacy`.)

| Data type (App Store category) | What it is in Parcade | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|---|
| Contact Info > Email Address | Account sign-in (Supabase auth) | Yes | Yes | No | App Functionality |
| Contact Info > Name | First name on the account; player names typed into rounds | Yes | Yes | No | App Functionality |
| Identifiers > User ID | Supabase user id on rounds, coins, items | Yes | Yes | No | App Functionality |
| User Content > Gameplay Content | Scores, rounds, chat messages, bets, predictions, seasons, tournaments, character outfit, handicap | Yes | Yes | No | App Functionality |
| Purchases > Purchase History | Club subscription status and coin purchases (website, via Stripe); coin ledger and Pro Shop items | Yes | Yes | No | App Functionality |
| User Content > Photos or Videos | A scorecard photo sent to the scanner (`netlify/functions/scan.mjs` passes it to Anthropic's API to read the pars). Not stored by Parcade. | Yes (see note) | Yes | No | App Functionality |

Not collected: location, contacts, health, financial info (cards are entered only on Stripe's own pages on the website), browsing history, search history, diagnostics or crash data, advertising data, sensitive info.

Note on photos: Apple's definition of "collect" excludes data processed only in real time and not stored. The scanner photo is processed during the request and not saved, so it could be left off. Declaring it is the safer answer and matches the camera permission text; keep it unless Apple says otherwise.

Privacy Policy URL: `https://parcade.golf/privacy`. Support URL: `mailto:support@parcade.golf` is not accepted; use `https://parcade.golf` (or a support page) as the Support URL.

## 3. Screenshots

Required sizes (portrait, PNG, no alpha):
- **6.9"** (iPhone 16 Pro Max / 17 Pro Max simulator): 1320 x 2868
- **6.5"** (iPhone 11 Pro Max / XS Max simulator): 1242 x 2688

Take them in the simulator with the demo account (Cmd+S saves at the right size). Use rounds with 3 to 4 players with real-looking names, dark mode, and no debug banners. Best screens, in this order:

1. **Home** with Crabby behind the Pro Shop counter and your character next to him (the app's personality in one shot).
2. **Score pad during a round** (Hole tab): hole info, player chips, the big number pad.
3. **Leaderboard** tab mid-round in a fun mode like Skins or Wolf.
4. **Results**: the podium with characters celebrating, plus payouts.
5. **Game mode picker** in round setup, showing the list of formats.
6. **Scorecard scanner** result filling in a course (show the photo step or the filled pars).
7. **Character / Pro Shop** with gear and coin prices.
8. **Tournament bracket** or **Season standings**.

Caption ideas: "Keep score with your crew", "13 ways to play", "Crabby keeps everyone honest", "Scan the card, skip the typing", "Dress your golfer".

Don't show anything that suggests real-money gambling (keep stakes screens out, or show only the "who owes whom" summary), and don't show any Club or coin prices.
