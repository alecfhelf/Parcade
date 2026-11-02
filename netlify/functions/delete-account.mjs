// Deletes the signed-in account (App Store guideline 5.1.1(v); the website uses it too).
// 1. Cancels any live Stripe subscription right away.
// 2. delete_account_prepare (supabase/delete-account.sql) anonymizes their players rows and hands on rounds,
//    seasons and tournaments other people still use.
// 3. Deletes the auth user. Coins, items, ledger, Club and comp rows cascade with it.
import Stripe from "stripe";
import { json, sessionUser, clubRow, service, deleteAuthUser } from "../lib/supa.mjs";

const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { user, error } = await sessionUser(req, "delete-account");
  if (error) return error;
  if (user.is_anonymous) return json({ error: "Sign in first." }, 403);
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);

  // 1. Stripe: stop billing before anything else, so a failure here leaves the account untouched
  try {
    const row = await clubRow(user.id);
    if (row && row.stripe_customer_id) {
      const { STRIPE_SECRET_KEY } = process.env;
      if (!STRIPE_SECRET_KEY) return json({ error: "Couldn't reach billing to cancel your Club. Try again later." }, 500);
      const stripe = new Stripe(STRIPE_SECRET_KEY);
      const subs = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: "all", limit: 100 });
      for (const sub of subs.data) {
        if (LIVE.has(sub.status)) await stripe.subscriptions.cancel(sub.id);
      }
    }
  } catch (e) {
    console.error("delete-account: stripe cancel failed", user.id, e);
    return json({ error: "Couldn't cancel your Club membership, so nothing was deleted. Try again in a sec." }, 502);
  }

  // 2 + 3. Database, then the auth user
  try {
    await service("rpc/delete_account_prepare", { method: "POST", body: JSON.stringify({ p_user: user.id }) });
    await deleteAuthUser(user.id);
  } catch (e) {
    console.error("delete-account failed", user.id, e);
    return json({ error: "Couldn't delete your account. Try again, or email support@parcade.golf." }, 502);
  }
  return json({ deleted: true });
};
