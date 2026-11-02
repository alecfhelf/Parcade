// Starts a one-time Stripe Checkout for a coin bundle. The webhook credits the coins once Stripe says it's paid.
import Stripe from "stripe";
import { json, sessionUser, clubRow, saveClubRow, siteUrl } from "../lib/supa.mjs";
import { COIN_BUNDLES } from "../lib/coins.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const { STRIPE_SECRET_KEY } = process.env;
  if (!STRIPE_SECRET_KEY) return json({ error: "Coin sales aren't set up yet." }, 500);

  const { user, error } = await sessionUser(req, "coins-checkout");
  if (error) return error;
  if (user.is_anonymous || !user.email) return json({ error: "Create an account first." }, 403);

  const body = await req.json().catch(() => ({}));
  const bundle = Object.hasOwn(COIN_BUNDLES, String(body.bundle)) ? COIN_BUNDLES[String(body.bundle)] : null;
  if (!bundle) return json({ error: "That bundle isn't for sale." }, 400);
  const price = (process.env[bundle.priceEnv] || "").trim();
  if (!price) return json({ error: "Coin sales aren't set up yet." }, 500);

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  try {
    // Same Stripe customer as the Club, so one person is one customer
    const row = await clubRow(user.id);
    let customer = row && row.stripe_customer_id;
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } },
        { idempotencyKey: "parcade-customer-" + user.id });
      customer = c.id;
      await saveClubRow({ user_id: user.id, stripe_customer_id: customer });
    }

    const site = siteUrl(req);
    const metadata = { kind: "coins", user_id: user.id, coins: String(bundle.coins) };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer,
      client_reference_id: user.id,
      metadata,
      payment_intent_data: { metadata },
      line_items: [{ price, quantity: 1 }],
      success_url: site + "/?coins=bought",
      cancel_url: site + "/"
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("coins checkout failed", e);
    return json({ error: "Couldn't start checkout: " + (e && e.message ? e.message : "unknown error") }, 502);
  }
};
