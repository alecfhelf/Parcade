// Starts a Stripe Checkout for the Parcade Club subscription. The webhook turns it into a membership.
import Stripe from "stripe";
import { json, sessionUser, clubRow, saveClubRow, isActive, siteUrl } from "../lib/supa.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) return json({ error: "The Club isn't set up yet." }, 500);

  const { user, error } = await sessionUser(req, "checkout");
  if (error) return error;
  if (user.is_anonymous || !user.email) return json({ error: "Create an account first." }, 403);

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  try {
    const row = await clubRow(user.id);
    if (isActive(row)) return json({ error: "You're already a Club Member." }, 409);

    let customer = row && row.stripe_customer_id;
    if (!customer) {
      // Same key for a double tap, so Stripe hands back the same customer instead of making two
      const c = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } },
        { idempotencyKey: "parcade-customer-" + user.id });
      customer = c.id;
      await saveClubRow({ user_id: user.id, stripe_customer_id: customer });
    }

    const site = siteUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_collection: "if_required",
      success_url: site + "/club?joined=1",
      cancel_url: site + "/club"
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("checkout failed", e);
    return json({ error: "Couldn't start checkout. Try again in a sec." }, 502);
  }
};
