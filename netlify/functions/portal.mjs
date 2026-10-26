// Stripe Billing Portal for a Club Member: cancel, update card, see invoices.
import Stripe from "stripe";
import { json, sessionUser, clubRow, siteUrl } from "../lib/supa.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const { STRIPE_SECRET_KEY } = process.env;
  if (!STRIPE_SECRET_KEY) return json({ error: "The Club isn't set up yet." }, 500);

  const { user, error } = await sessionUser(req, "portal");
  if (error) return error;
  if (user.is_anonymous) return json({ error: "Sign in first." }, 403);

  try {
    const row = await clubRow(user.id);
    if (!row || !row.stripe_customer_id || !row.stripe_subscription_id) return json({ error: "No Club membership on this account." }, 404);
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: siteUrl(req) + "/club" });
    return json({ url: session.url });
  } catch (e) {
    console.error("portal failed", e);
    return json({ error: "Couldn't open billing. Try again in a sec." }, 502);
  }
};
