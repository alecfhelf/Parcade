const BASE = "https://api.opengolfapi.org/v1/courses";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json",
    "cache-control": "public, max-age=3600",
    "netlify-cdn-cache-control": status === 200 ? "public, s-maxage=86400" : "no-store"
  }
});

const get = async (url) => {
  const key = process.env.OPENGOLFAPI_KEY;
  const r = await fetch(url, { headers: key ? { authorization: "Bearer " + key } : {} });
  if (!r.ok) throw new Error("OpenGolfAPI " + r.status);
  return r.json();
};

export default async (req) => {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").trim().slice(0, 80);
  const id = (u.searchParams.get("id") || "").trim();
  try {
    if (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Bad course id" }, 400);
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
