// ---------- Season scoring (pure: no DOM, testable with plain Node) ----------
const SS_DEFAULT_PARS = Array(18).fill(4);
const ssR1 = n => Math.round(n * 10) / 10;
const ssClamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const ssSum = a => a.reduce((x, y) => x + y, 0);

function coursePars(course) {
  return course && Array.isArray(course.pars) && course.pars.length === 18 ? course.pars.map(Number) : SS_DEFAULT_PARS;
}

// USGA approximations. gender "F" uses the women's formula, anything else the men's.
function yardageEstimate(yards, gender) {
  const f = gender === "F";
  const scratch = f ? yards / 180 + 40.1 : yards / 220 + 40.9;
  const bogey = f ? yards / 120 + 51.3 : yards / 160 + 50.7;
  return { rating: scratch, slope: (f ? 4.24 : 5.381) * (bogey - scratch) };
}

// samples: { samples: [{ gross, hcp }], players: n } from the course_samples RPC
function resolveDifficulty(course, samples) {
  const par = ssSum(coursePars(course));
  const fix = (rating, slope) => ({ rating: ssClamp(rating, par - 6, par + 8), slope: ssClamp(slope, 55, 155) });
  let base, source, detail;
  if (course && Number(course.rating) > 0 && Number(course.slope) > 0) {
    base = fix(Number(course.rating), Number(course.slope));
    source = course.rating_source === "tee_estimate" ? "estimated" : "official";
    detail = source === "official" ? "Official rating." : "Estimated from another tee.";
  } else if (course && Number(course.yardage) > 0) {
    const e = yardageEstimate(Number(course.yardage), course.tee_gender);
    base = fix(ssR1(e.rating), Math.round(e.slope));
    source = "estimated";
    detail = "Estimated from yardage.";
  } else {
    base = fix(par, 113);
    source = "default";
    detail = course ? "No rating for this course." : "No course picked.";
  }
  const list = (samples && Array.isArray(samples.samples) ? samples.samples : [])
    .filter(s => s && isFinite(s.gross) && s.hcp != null && isFinite(s.hcp));
  const res = list.map(s => Number(s.gross) - (base.rating + Number(s.hcp) * base.slope / 113)).filter(r => Math.abs(r) <= 15);
  const n = res.length;
  if (n >= 5 && ((samples && samples.players) || 0) >= 3) {
    const w = n / (n + 10);
    const rating = fix(base.rating + w * (ssSum(res) / n), base.slope).rating;
    return { rating: ssR1(rating), slope: base.slope, source: "learned", detail: "Learned from " + n + " rounds." };
  }
  return { rating: ssR1(base.rating), slope: Math.round(base.slope), source, detail };
}

function difficultyBadge(d) {
  if (!d) return "Default";
  return d.source === "official" ? "Official" : d.source === "estimated" ? "Estimated"
    : d.source === "learned" ? d.detail.replace(/\.$/, "") : "Default";
}

// Same spread as strokesOn in app.js: by hole handicap when we have it, evenly otherwise.
function strokesByHole(ch, hcpIndex) {
  const ranked = Array.isArray(hcpIndex) && hcpIndex.length === 18;
  const out = [];
  for (let hole = 1; hole <= 18; hole++) {
    if (ranked) {
      const rank = Number(hcpIndex[hole - 1]);
      out.push(ch >= rank ? Math.floor((ch - rank) / 18) + 1 : 0);
    } else {
      const a = ch / 18;
      out.push(Math.floor(hole * a + 1e-9) - Math.floor((hole - 1) * a + 1e-9));
    }
  }
  return out;
}

// strokes: 18 numbers (11 means 11+, scored as 11)
function scoreRound({ h, strokes, pars, hcpIndex, rating, slope }) {
  pars = pars || SS_DEFAULT_PARS;
  const ch = Math.max(0, Math.round(h * slope / 113 + (rating - ssSum(pars))));
  const st = strokesByHole(ch, hcpIndex);
  const gross = ssSum(strokes);
  const adjusted = ssSum(strokes.map((s, i) => Math.min(s, pars[i] + 2 + st[i])));
  const raw = (adjusted - rating) * 113 / slope;
  return {
    ch, gross, adjusted,
    roundRating: ssR1(raw),
    points: ssR1(ssClamp(10 + 2 * (h - raw), 0, 30)),
    hAfter: ssR1(h + 0.2 * (raw - h)),
  };
}

// members: [{ user_id, name, handicap }]
// entries: [{ user_id, round_id, date, strokes[18], pars, hcpIndex, diff: { rating, slope, ... }, ...anything else }]
// Returns standings rows, best first: { member, rounds, counted, points, avg, best, h, h2h: { w, l, t }, place }
// Each round also gets beat / lostTo / tied: user_ids of other members in the same round.
function scoreSeason({ format, count, members, entries }) {
  const all = [];
  const rows = members.map(member => {
    const mine = entries.filter(e => e.user_id === member.user_id)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.round_id).localeCompare(String(b.round_id)));
    let h = Number(member.handicap) || 0;
    const rounds = mine.map(e => {
      const s = scoreRound({ h, strokes: e.strokes, pars: e.pars, hcpIndex: e.hcpIndex, rating: e.diff.rating, slope: e.diff.slope });
      const rec = { ...e, ...s, hBefore: h, beat: [], lostTo: [], tied: [] };
      h = s.hAfter;
      all.push(rec);
      return rec;
    });
    return { member, rounds, h };
  });

  // Head-to-head: bragging rights only, never touches points
  const byRound = new Map();
  all.forEach(r => { if (!byRound.has(r.round_id)) byRound.set(r.round_id, []); byRound.get(r.round_id).push(r); });
  byRound.forEach(group => {
    group.forEach(r => group.forEach(o => {
      if (o === r || o.user_id === r.user_id) return;
      const a = ssR1(r.roundRating), b = ssR1(o.roundRating);
      (a < b ? r.beat : a > b ? r.lostTo : r.tied).push(o.user_id);
    }));
  });
  rows.forEach(row => {
    row.h2h = { w: 0, l: 0, t: 0 };
    row.rounds.forEach(r => { row.h2h.w += r.beat.length; row.h2h.l += r.lostTo.length; row.h2h.t += r.tied.length; });
  });

  rows.forEach(row => {
    let counted = row.rounds.slice(0, format === "rounds" ? count : row.rounds.length);
    if (format === "dates") counted = counted.slice().sort((a, b) => b.points - a.points).slice(0, count);
    row.counted = new Set(counted);
    row.points = ssR1(ssSum(counted.map(r => r.points)));
    row.avg = counted.length ? row.points / counted.length : 0;
    row.best = counted.length ? Math.max(...counted.map(r => r.points)) : 0;
  });
  rows.sort((a, b) => b.points - a.points || b.avg - a.avg || b.best - a.best);
  rows.forEach((r, i) => {
    const p = rows[i - 1];
    r.place = i && p.points === r.points && p.avg === r.avg && p.best === r.best ? p.place : i;
  });
  return rows;
}

// "upcoming", "active" or "final". entryCounts: Map of user_id -> number of entries.
function seasonStatus(season, members, entryCounts, now) {
  now = now || new Date();
  if (season.format === "dates") {
    if (now < new Date(season.starts_at)) return "upcoming";
    return now > new Date(season.ends_at) ? "final" : "active";
  }
  if (season.format !== "rounds") return null;
  if (season.ended_at) return "final";
  const full = members.length && members.every(m => ((entryCounts && entryCounts.get(m.user_id)) || 0) >= season.rounds_count);
  return full ? "final" : "active";
}

if (typeof module !== "undefined") {
  module.exports = { coursePars, yardageEstimate, resolveDifficulty, difficultyBadge, strokesByHole, scoreRound, scoreSeason, seasonStatus };
}
