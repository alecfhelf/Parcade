// Stripe webhook: keeps club_subscriptions in step with Stripe.
// Every event re-reads the subscription from Stripe and writes its current state, so replays and
// out-of-order events all land on the same row.
import Stripe from "stripe";
import { json, service, saveClubRow, isActive } from "../lib/supa.mjs";

const HANDLED = new Set(["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);
const iso = s => (s ? new Date(s * 1000).toISOString() : null);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) return json({ error: "Not set up" }, 500);
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const body = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, req.headers.get("stripe-signature") || "", STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error("webhook signature failed", e.message);
    return json({ error: "Bad signature" }, 400);
  }
  if (!HANDLED.has(event.type)) return json({ received: true });

  const obj = event.data.object;
  let subId, userId;
  if (event.type === "checkout.session.completed") {
    if (obj.mode !== "subscription" || !obj.subscription) return json({ received: true });
    subId = typeof obj.subscription === "string" ? obj.subscription : obj.subscription.id;
    userId = obj.client_reference_id || (obj.metadata && obj.metadata.user_id);
  } else {
    subId = obj.id;
    userId = obj.metadata && obj.metadata.user_id;
  }

  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    userId = userId || (sub.metadata && sub.metadata.user_id);
    let existing = null;
    if (userId) {
      existing = (await service("club_subscriptions?select=*&user_id=eq." + encodeURIComponent(userId)))[0] || null;
    } else {
      existing = (await service("club_subscriptions?select=*&stripe_customer_id=eq." + encodeURIComponent(customer)))[0] || null;
      userId = existing && existing.user_id;
    }
    if (!userId) {
      console.error("webhook: no Parcade user for", event.type, subId, customer);
      return json({ received: true });
    }

    // Newer Stripe API versions keep the period on the subscription item
    const item = sub.items && sub.items.data && sub.items.data[0];
    let periodEnd = sub.current_period_end || (item && item.current_period_end) || null;
    // A scheduled cancel (cancel_at) ends access then, even if that's before the period would end
    if (sub.cancel_at && (!periodEnd || sub.cancel_at < periodEnd)) periodEnd = sub.cancel_at;
    const row = {
      user_id: userId,
      stripe_customer_id: customer,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: iso(periodEnd),
      cancel_at_period_end: !!(sub.cancel_at_period_end || sub.cancel_at)
    };

    // Don't let an old, dead subscription overwrite a different one that's live
    if (existing && existing.stripe_subscription_id && existing.stripe_subscription_id !== sub.id
        && isActive(existing) && !isActive(row)) {
      return json({ received: true });
    }
    await saveClubRow(row);
    return json({ received: true });
  } catch (e) {
    // 500 so Stripe retries later
    console.error("webhook failed", event.type, e);
    return json({ error: "Webhook failed" }, 500);
  }
};
