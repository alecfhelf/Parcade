# Brief: Buy coins with Stripe (app and website)

## Goal
Make the existing **Buy coins** screen (`buyCoinsScreen()` in `public/app.js`, reached from the coin badge menu) actually sell coins through Stripe Checkout. Coins are credited by the server only, through the Stripe webhook, never by the browser.

## Bundles (update the existing ones)
| Price | Coins |
|---|---|
| $1 | 10 |
| $5 | 60 |
| $10 | 150 |

- **Display:** replace the current 10/55/120 values and the "Coming soon" buttons with these.
- **Labels:** show a small "Best value" tag on the $10 bundle, and a bonus line where it helps, e.g. "+20% bonus" on $5 and "+50% bonus" on $10, compared with the $1 rate.
- **Single source of truth:** the server is the only source for which bundle gives how many coins (see below). The client list is display only.

## Who can buy
- **Signed-in accounts only:** both free accounts and Club members.
- **Guests** see the bundles, but tapping one goes through the existing `needAccount("buying coins")` flow.

## Stripe
- **Products:** Alec creates 3 one-time Products/Prices in Stripe ("Parcade Coins – 10", "– 60", "– 150"), in both test and live mode.
- **Env vars:** `STRIPE_PRICE_COINS_10`, `STRIPE_PRICE_COINS_60`, `STRIPE_PRICE_COINS_150`, with different values per deploy context, the same way the Club keys are set.
- **`netlify/functions/checkout.mjs`:** extend it, or add `coins-checkout.mjs` if that's cleaner. A POST with `{ bundle: "10" | "60" | "150" }`:
  - Verify the bearer token the same way the Club checkout does, and reject anonymous users.
  - Map the bundle to its env price ID **and** its coin amount on the server. Never trust a coin amount from the client.
  - Create a Checkout Session with `mode: "payment"`, reusing or creating the same Stripe customer as Club.
  - Metadata: `{ kind: "coins", user_id, coins: "<amount>" }`.
  - Return URLs: `success_url: /?coins=bought`, `cancel_url: /`.
  - Promo codes are **not** allowed on coin purchases.
- **`stripe-webhook.mjs`:** on `checkout.session.completed` where `metadata.kind === "coins"` and `payment_status === "paid"`, credit the coins using the service role.
  - Must be **idempotent**: replaying the same event or session never double-credits.
  - Club subscription handling must keep working exactly as it does now.

## Database: `supabase/buy-coins.sql`
- **New function `credit_coin_purchase(p_user uuid, p_coins int, p_session text)`:**
  - Security definer, callable **only** by the service role (revoke from public, anon and authenticated).
  - Adds the coins to `user_coins` (creating the row if missing) and writes a `coin_ledger` row with the reason "Bought <n> coins".
  - Records `p_session` so the same session can never credit twice: add a nullable unique `stripe_session text` column on `coin_ledger`, or use a small `coin_purchases` table with a unique session id.
- **RLS:** coin tables stay read-only to users, as they are now.

## After paying
- When the page loads with `?coins=bought`:
  - Show a toast with a Crabby line ("Coins are in. Try not to blow them all on one hat.").
  - Refresh the coin badge, polling for a few seconds until the balance changes, since the webhook can lag.
  - Clean the query string afterwards.
- **Admin page:** coin purchases show in "Recent coin activity" through the ledger automatically. Confirm they do.

## How to earn screen
Mention that coins can also be bought, linking to the Buy coins screen.

## Constraints
- Works on both the website and the app. Use app-only layout tweaks only if needed, scoped to `.in-app`.
- Don't change coin rewards, prices in the Pro Shop or the Club subscription.
- Don't run git or deploy. At the end, list:
  1. the SQL to run,
  2. the new env vars,
  3. the exact Stripe Dashboard steps for the 3 coin products in test and live mode. The existing webhook already sends `checkout.session.completed`, so say whether anything needs adding.

## Done when
- In test mode, buying each bundle with the 4242 card credits exactly 10, 60 or 150 coins once, and the ledger and badge update.
- Replaying the webhook event doesn't double-credit.
- Guests are asked to make an account.
