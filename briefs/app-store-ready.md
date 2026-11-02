# Brief: App Store readiness (iOS app, part 1 of 2)

Make the Capacitor iOS app (`ios/`, `capacitor.config.json`) meet Apple's review requirements. In-app purchases are part 2 and NOT in this brief.

Web code changes that only matter in the app are scoped to `html.in-app` / `window.Capacitor.isNativePlatform()`. Native changes go in `ios/` and the Capacitor config.

The app loads the live site (`server.url: https://parcade.golf`), so web changes ship with a normal deploy. Native/config changes need `npx cap sync ios` and a rebuild; list those steps at the end.

## 1. In-app account deletion (required by Apple guideline 5.1.1(v))
- **Profile menu / Edit profile:** add **Delete account** (red, at the bottom), for signed-in accounts only.
- **Flow:**
  1. A confirm screen explains what happens: "This permanently deletes your account, character, coins, gear and stats. Rounds you played stay for the other players, under 'Deleted player'."
  2. The user types `DELETE` to confirm.
  3. If they have an active Club subscription through Stripe, say it will be cancelled.
- **Server: new `netlify/functions/delete-account.mjs`** (POST, bearer token, same `sessionUser` pattern as the other functions):
  - Cancel any active Stripe subscription for the user immediately (`stripe.subscriptions.cancel`).
  - Anonymize their `players` rows: name becomes "Deleted player", `user_id` becomes null. Check the FK/RLS constraints and do it in SQL if that's cleaner.
  - Delete the auth user with the service role (`auth.admin.deleteUser`). Rows that reference `auth.users` with on delete cascade go with it (coins, items, ledger, club rows, comps).
  - Make sure seasons/tournaments they own don't break: transfer or leave them owner-less as the existing delete logic allows. Read `supabase/deletes.sql` first.
  - Add any SQL in `supabase/delete-account.sql`.
- **Afterwards:** sign out locally, clear local storage, and show "Your account was deleted."
- **Website too:** this works on the website as well; it's a good requirement everywhere.

## 2. Permissions text (Info.plist)
`NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`:
"Parcade uses your camera and photos so you can scan a golf scorecard and fill in the course for you." Add only the keys the app actually uses.

## 3. Launch screen, status bar, orientation
- **Launch screen:** dark (`#050817`) with the Parcade icon centered. Use `@capacitor/splash-screen` + `npx capacitor-assets generate --ios` (add `assets/splash.png` / `splash-dark.png` generated from the existing icon on the dark background). The splash hides as soon as the page has loaded.
- **Status bar:** `@capacitor/status-bar` with light content on dark; follow the theme if light mode is on.
- **Orientation:** portrait only on iPhone.

## 4. Native feel (Apple guideline 4.2, minimum functionality)
- **Haptics** (`@capacitor/haptics`): a light impact on score pad taps, medium on finishing a hole, and a success notification on winning, a podium or a purchase. Only in the app.
- **Share:** use `@capacitor/share` for Invite friends and results sharing in the app, falling back to `navigator.share`.
- **External links:**
  - Terms, Privacy, Stripe Billing Portal and any other site: open with `@capacitor/browser` (in-app Safari sheet) instead of navigating the WebView away.
  - Links within parcade.golf stay in the app.

## 5. Offline / error screen
With `server.url` the app shows a blank or error page when there's no connection. Add a bundled `public/offline.html` (dark, Crabby line "No signal. Even I can't keep score without the internet.", a **Try again** button that reloads `https://parcade.golf`) and set `server.errorPath` in `capacitor.config.json` so the WebView shows it on load failure. Check the Capacitor version supports `errorPath`; if not, use the closest supported approach.

## 6. Purchases in the iOS app until part 2
Apple rejects apps that sell digital goods (Club, coins) outside in-app purchase except where its current link-out rules allow it. Until part 2 is built:
- In the iOS app, **hide** the Stripe purchase entry points: Become a Club Member, Buy coins, and checkout buttons on `/club`.
- Club-locked features show "This is a Club perk" with no purchase link.
- Coins can still be earned and spent.
- Existing members keep everything; membership checks are unchanged.

## 7. Privacy and metadata support
- **Privacy manifest:** confirm a `PrivacyInfo.xcprivacy` exists for the app target, covering required-reason APIs used by Capacitor/plugins (UserDefaults etc.). Add or merge it if missing.
- **Settings ≈ About:** the profile menu already links Terms and Privacy. Also add **Contact support** (`mailto:support@parcade.golf`).
- **App name:** "Parcade" in Xcode, bundle ID `golf.parcade.app`, version 1.0.0, build 1.

## 8. Review checklist file
Create `briefs/app-review-notes.md` with:
- Draft App Review notes explaining:
  - Parcade tracks friendly bets but never holds, moves or processes money.
  - How to reach every feature.
  - That a demo account is provided (Alec will create it).
- A list of the App Privacy "nutrition label" answers based on what the code actually collects: email, name, gameplay data, purchases, and the scorecard photos sent to the scanner. Mark each as linked to the user or not, used for tracking or not (there should be no tracking).
- The screenshots to capture (sizes 6.9" and 6.5") and which screens make the best ones.

## Constraints
- Don't change game logic.
- Don't run git or deploy.
- At the end, list:
  1. the SQL to run,
  2. the `npm install` + `npx cap sync ios` commands,
  3. any Xcode steps Alec must do by hand (signing team, capabilities, etc.).

## Done when
- In the simulator: an account can be deleted end to end.
- The camera prompt shows the new text.
- The launch screen and status bar look right, and haptics fire on device.
- External links open in the in-app browser.
- Offline shows the offline page.
- No Stripe purchase entry points appear in the iOS app.
- The review notes file exists.
