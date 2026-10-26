// Shared by the Netlify functions: check the caller's Supabase session, ask the database if they're a Club Member,
// and read or write with the service role (server only, never sent to the browser).

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" }
});

const base = () => (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const anonKey = () => (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
const serviceKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

// The signed-in user behind the request's bearer token: { user, auth } or { error: Response }
export async function sessionUser(req, tag) {
  if (!base() || !anonKey()) return { error: json({ error: "This isn't set up yet." }, 500) };
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer \S+/.test(auth)) return { error: json({ error: "No session found. Refresh the page and try again." }, 401) };
  const who = await fetch(base() + "/auth/v1/user", { headers: { apikey: anonKey(), authorization: auth } })
    .catch(e => { console.error(tag + " auth fetch failed", e); return null; });
  if (!who || !who.ok) {
    const code = who ? who.status : "network";
    console.error(tag + " auth check failed:", code, who ? (await who.text()).slice(0, 200) : "");
    return { error: json({ error: "Session check failed (" + code + "). Refresh and try again." }, 401) };
  }
  return { user: await who.json(), auth };
}

// is_club_member() run as the caller, so the database decides. Any failure counts as not a member.
export async function isClubMember(auth) {
  try {
    const r = await fetch(base() + "/rest/v1/rpc/is_club_member", {
      method: "POST",
      headers: { apikey: anonKey(), authorization: auth, "content-type": "application/json" },
      body: "{}"
    });
    return r.ok && (await r.json()) === true;
  } catch (e) {
    console.error("is_club_member failed", e);
    return false;
  }
}

// PostgREST with the service role key (bypasses RLS). Throws on a non-2xx answer.
export async function service(path, init = {}) {
  if (!base() || !serviceKey()) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  const r = await fetch(base() + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: serviceKey(), authorization: "Bearer " + serviceKey(), "content-type": "application/json", ...(init.headers || {}) }
  });
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + (await r.text()).slice(0, 300));
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

export async function clubRow(userId) {
  const rows = await service("club_subscriptions?select=*&user_id=eq." + encodeURIComponent(userId));
  return rows[0] || null;
}

// Insert or merge one club_subscriptions row by user_id
export function saveClubRow(row) {
  return service("club_subscriptions?on_conflict=user_id", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() })
  });
}

export const isActive = row => !!row && ["active", "trialing"].includes(row.status)
  && !!row.current_period_end && new Date(row.current_period_end) > new Date();

// Where Stripe sends people back to. Netlify sets URL to the site's main address.
export const siteUrl = req => (process.env.URL || new URL(req.url).origin).replace(/\/+$/, "");
