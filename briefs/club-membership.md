# Brief: Club Membership (Stripe subscription) + three access tiers

## Goal
Add a $6.95/month **Club Member** subscription through Stripe and split Parcade into three tiers: **Guest** (no account), **Free account**, and **Club Member**. The server decides who's a member, never the browser.

## The three tiers

### Guest (anonymous, no email)
- **Start a round:** Stroke Play only, with no course lookup, no scorecard scan and no manual pars or handicaps. The course step only offers "Skip, no course".
- **Settings:** only One Device Mode. No mulligans, bets/pot or anything else.
- **Mini-golf:** can start a round, but with no scan and no manual pars, so "Skip, no scorecard" is the only course option.
- **Join with a code:** always allowed. Joiners play under the host's settings.
- **Saving rounds:** no Recent rounds (already gated on home). Keep the existing behavior where creating an account on the winner screen upgrades the same user, so the round they just played is kept.
- **Locked:** seasons, tournaments, character, Pro Shop and coins (already gated through `HOME_GATED` / `needAccount`).

### Free account (email, not subscribed)
- **Rounds:** everything a guest has.
- **Unlocks:** Seasons, Tournaments, Recent rounds, the dressing room / custom character, and full Pro Shop and coins.
- **Round setup:** same limits as guests (Stroke Play only, no course lookup/scan/manual pars/handicaps, One Device Mode only). The same limits apply inside season and tournament setup: stroke only, no course lookup.

### Club Member (active subscription)
- **Unlocks:** everything else: course lookup, scorecard reader, manual pars and handicaps (separately), every game mode, and every setting (mulligans, bets/pot, payout presets, etc.).
- **Title:** "Club Member" shows as a small gold badge next to their name in the profile menu, Edit profile, the account line on home, and the round room/player list. Make it subtle, not loud.

## Gating in the app (`public/app.js`)
- Add one helper, `tier()`, that returns `"guest" | "free" | "club"`. The source is `window.__signedIn` plus a cached `is_club_member()` result, loaded with the session and refreshed after checkout.
- Replace `guestModeLock()` with a tier-based lock. Any locked mode, setting or course option uses the existing `locked-feature` styling. Tapping it calls:
  - `needAccount(what)` for guest-only locks (unchanged), or
  - a new `needClub(what)`: a `pickFrom` with "Become a Club Member" (→ `/club`) and "Not now". Crabby line: "That's a Club Member perk, bud."
- The first-time-mode 10-coin bonus copy in How to earn should say other modes come with Club.

## Stripe
Alec creates the Product and Price in the Stripe Dashboard ("Parcade Club", $6.95/month recurring) and sets the env vars in Netlify.
- **Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, never in `public/`). Reuse the existing `SUPABASE_URL`.
- **`netlify/functions/checkout.mjs`** (POST):
  - Verify the bearer token the same way `scan.mjs` does. Reject anonymous users ("Create an account first").
  - Reuse or create the Stripe customer (stored in `club_subscriptions.stripe_customer_id`).
  - Create a Checkout Session: `mode: "subscription"`, `client_reference_id` = user id, `metadata.user_id`, the customer's email, `success_url: /club?joined=1`, `cancel_url: /club`. Return `{ url }`.
- **`netlify/functions/portal.mjs`** (POST): for an authed member, create a Stripe Billing Portal session (cancel, update card) and return `{ url }`.
- **`netlify/functions/stripe-webhook.mjs`:**
  - Verify the signature against the raw body (`await req.text()`) with `STRIPE_WEBHOOK_SECRET`.
  - Handle `checkout.session.completed` and `customer.subscription.created/updated/deleted`.
  - Upsert `club_subscriptions` with the service role key. It must be idempotent and safe to replay.
- Use the official `stripe` npm package. Add a `package.json` at the project root if there isn't one, so Netlify installs it.

## Database: `supabase/club.sql`
- **Table `public.club_subscriptions`:** `user_id uuid pk references auth.users on delete cascade`, `stripe_customer_id text unique`, `stripe_subscription_id text`, `status text`, `current_period_end timestamptz`, `cancel_at_period_end boolean default false`, `updated_at timestamptz default now()`.
  - RLS on: users can select only their own row. There are no insert/update/delete policies; only the webhook (service role) writes.
- **`public.is_club_member(p_user uuid default auth.uid()) returns boolean`:** security definer, stable. True when status is `active` or `trialing` and `current_period_end > now()`. Canceled-at-period-end members keep access until the period ends. Grant to authenticated and anon.
- **Server-side guard:** a trigger on `rounds` insert/update. If the host isn't a club member, reject a non-`stroke` mode, a non-null `course_id`, bets/pot, mulligans and other paid settings. Read the current `rounds` columns to get the exact field names. Mini rounds with `mini_course` set also need club.
- **Other server checks:** `scan.mjs` and `courses.mjs` call `is_club_member` with the user's token and return 403 "Club Members only" when false. The scan costs real money per call.
- **Admin:** add a "Club" yes/no column to the `admin_accounts` result and a "Club Members" count card on `admin.html`.

## Subscription page: `public/club.html` (+ `/club` redirect in `netlify.toml`)
- Same look as the app (fonts, dark/light theme via the saved pref, neon style). Back link to `/`.
- **Heading:** "Become a Club Member". **Price:** "$6.95/month", with "Cancel anytime" under it.
- **Benefits list:**
  - Every game mode: Party, Skins, Match Play, Wolf, Vegas and more
  - Course lookup with real pars and hole handicaps
  - Scorecard scanner
  - Enter pars and handicaps yourself
  - Mulligans, bets and payout presets
  - "Club Member" title next to your name
- **Button by state:**
  - Guest: "Create a free account first" (sends to home and opens create account).
  - Free: "Join the Club" (calls checkout and redirects to Stripe).
  - Member: "You're a Club Member", shows the renewal or end date and a "Manage subscription" button (portal).
- With `?joined=1`: show a thank-you and poll `is_club_member` for a few seconds until the webhook lands.
- **Entry points:** a "Become a Club Member" item in the profile menu (members see "Club membership" instead), and every `needClub` prompt.

## Constraints
- Never trust the client for membership: the DB function, trigger and function checks are the real gate.
- Don't break existing rounds, seasons, tournaments or coins.
- Short, plain wording in the existing Crabby voice.
- Don't run git or deploy. At the end, list:
  1. the SQL to run,
  2. the Netlify env vars to set,
  3. the exact Stripe Dashboard steps: product and price, the webhook endpoint URL `https://parcade.golf/.netlify/functions/stripe-webhook` with its events, and turning on the Customer Portal.

## Done when
- A guest, a free account and a test-mode member each see exactly their tier's options.
- A Stripe test-mode checkout turns an account into a member within seconds, with no page reload hacks.
- Canceling in the portal keeps access until the period ends, then it locks again.
- `scan`, `courses` and paid round settings are refused server-side for non-members.
