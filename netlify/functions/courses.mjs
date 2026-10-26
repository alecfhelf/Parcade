import { sessionUser, isClubMember } from "../lib/supa.mjs";

const BASE = "https://api.opengolfapi.org/v1/courses";

// Club Members only, so answers are cached in the member's browser, never on the shared CDN
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": status === 200 ? "private, max-age=3600" : "no-store"
  }
});

const get = async (url) => {
  const key = process.env.OPENGOLFAPI_KEY;
  const r = await fetch(url, { headers: key ? { authorization: "Bearer " + key } : {} });
  if (!r.ok) throw new Error("OpenGolfAPI " + r.status);
  return r.json();
};

export default async (req) => {
  const who = await sessionUser(req, "courses");
  if (who.error) return who.error;
  if (!(await isClubMember(who.auth))) return json({ error: "Club Members only" }, 403);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const id = (u.searchParams.get("id") || "").trim();
  try {
    if (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Bad course id" }, 400);
      const full = await get("https://api.opengolfapi.org/api/v1/courses/" + id).catch(() => null);
      if (full && Array.isArray(full.holes_data) && full.holes_data.length) {
        return json({
          id: full.id, name: full.course_name || full.name, city: full.city, state: full.state, holes: full.holes,
          scorecard: full.holes_data.map(h => ({ hole: h.number, par: h.par, handicap: h.handicap_index })),
          tees: full.tees || []
        });
      }
      const [course, tees] = await Promise.all([
        get(BASE + "/" + id),
        get(BASE + "/" + id + "/tees").catch(() => ({ tees: [] }))
      ]);
      return json({
        id: course.id, name: course.name, city: course.city, state: course.state,
        holes: course.holes, scorecard: course.scorecard || [], tees: tees.tees || []
      });
    }
    if (q.length < 3) return json({ courses: [] });
    const data = await get(BASE + "/search?q=" + encodeURIComponent(q) + "&limit=10");
    return json({
      courses: (data.courses || []).slice(0, 10).map(c => ({
        id: c.id, name: c.name, city: c.city, state: c.state, par: c.par
      }))
    });
  } catch (e) {
    return json({ error: "Course lookup failed" }, 502);
  }
};
