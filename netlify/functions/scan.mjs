const MODEL = "claude-haiku-4-5-20251001";
const PROMPT = `Read this golf scorecard photo. Reply with ONLY a JSON object and no other text, in this shape:
{"name": course name or null,
 "location": "City, ST" or null,
 "pars": [18 integers, the par for holes 1 through 18 in order],
 "hcp_index": [18 integers, the men's handicap or stroke index row for holes 1 through 18] or null,
 "tees": [{"tee_name": string, "gender": "Male" or "Female" or null, "yardage": total yards as an integer or null, "course_rating": number or null, "slope": integer or null}]}
Use null for anything you cannot read clearly. Do not guess.
If the image is not a golf scorecard, reply {"error": "not a scorecard"}.`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" }
});
const int = (v) => { const n = Number(v); return Number.isInteger(n) ? n : null; };
const num = (v) => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) ? n : null; };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const { ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return json({ error: "Scanning isn't set up yet." }, 500);

  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer \S+/.test(auth)) return json({ error: "No session found. Refresh the page and try again." }, 401);
  const base = SUPABASE_URL.trim().replace(/\/+$/, "");
  const who = await fetch(base + "/auth/v1/user", { headers: { apikey: SUPABASE_PUBLISHABLE_KEY.trim(), authorization: auth } })
    .catch(e => { console.error("scan auth fetch failed", e); return null; });
  if (!who || !who.ok) {
    const code = who ? who.status : "network";
    console.error("scan auth check failed:", code, who ? (await who.text()).slice(0, 200) : "");
    return json({ error: "Session check failed (" + code + "). Refresh and try again." }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const image = typeof body.image === "string" ? body.image : "";
  if (!image || image.length > 5000000) return json({ error: "That photo is too big or empty." }, 400);

  let text = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1024,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text: PROMPT }
        ] }]
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ? data.error.message : "API " + r.status);
    text = (data.content || []).map(b => b.type === "text" ? b.text : "").join("");
  } catch (e) {
    return json({ error: "Crabby couldn't read it right now. Try again." }, 502);
  }

  let out;
  try { out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); }
  catch (e) { return json({ error: "Couldn't read that one. Try a clearer photo." }, 422); }
  if (out.error) return json({ error: "That doesn't look like a scorecard." }, 422);

  const raw = Array.isArray(out.pars) ? out.pars.map(int) : [];
  if (raw.length !== 18) return json({ error: "Parcade needs all 18 holes. Get the whole card in the photo." }, 422);
  const good = raw.filter(p => p >= 3 && p <= 6).length;
  if (good < 14) return json({ error: "Too blurry to read the pars. Try a clearer photo." }, 422);
  const pars = raw.map(p => (p >= 3 && p <= 6 ? p : 4));

  const h = Array.isArray(out.hcp_index) ? out.hcp_index.map(int) : [];
  const hcp_index = h.length === 18 && h.every(n => n >= 1 && n <= 18) && new Set(h).size === 18 ? h : null;

  const tees = (Array.isArray(out.tees) ? out.tees : [])
    .filter(t => t && typeof t.tee_name === "string" && t.tee_name.trim())
    .slice(0, 10)
    .map(t => ({
      tee_name: t.tee_name.trim().slice(0, 30),
      gender: t.gender === "Female" ? "Female" : t.gender === "Male" ? "Male" : null,
      yardage: int(t.yardage),
      course_rating: num(t.course_rating),
      slope: int(t.slope)
    }));

  return json({
    name: typeof out.name === "string" ? out.name.trim().slice(0, 80) : null,
    location: typeof out.location === "string" ? out.location.trim().slice(0, 60) : null,
    pars, hcp_index, tees
  });
};
