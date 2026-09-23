// ---------- Team games (Best Ball, and later Vegas) ----------
const TEAM_MODES = ["bestball", "vegas"];
const TEAM_NAMES = { 1: "Team A", 2: "Team B" };

function teamsOf(players, groupNo) {
  const g = players.filter(p => p.group_no === groupNo);
  const t1 = g.filter(p => p.team === 1), t2 = g.filter(p => p.team === 2);
  return { 1: t1, 2: t2, valid: g.length === 4 && t1.length === 2 && t2.length === 2 };
}

function bestBallState(round, players, scores, groupNo) {
  const t = teamsOf(players, groupNo);
  const out = { valid: t.valid, teams: t, totals: {}, holes: {} };
  players.filter(p => p.group_no === groupNo).forEach(p => (out.totals[p.id] = 0));
  if (!t.valid) return out;
  const allow = holeAllowances(round, players);
  const scoreOf = (p, h) => scores.find(x => x.player_id === p.id && x.hole === h && x.strokes);
  for (let h = 1; h <= 18; h++) {
    const s1 = t[1].map(p => scoreOf(p, h)), s2 = t[2].map(p => scoreOf(p, h));
    if ([...s1, ...s2].some(x => !x)) { out.holes[h] = null; continue; }
    const n1 = Math.min(...s1.map(x => netOf(x, allow))), n2 = Math.min(...s2.map(x => netOf(x, allow)));
    const winner = n1 < n2 ? 1 : n2 < n1 ? 2 : 0;
    if (winner) t[winner].forEach(p => out.totals[p.id]++);
    out.holes[h] = { winner, best: { 1: Math.min(...s1.map(x => x.strokes)), 2: Math.min(...s2.map(x => x.strokes)) } };
  }
  return out;
}

function bestBallTotals(round, players, scores) {
  const totals = {};
  [...new Set(players.map(p => p.group_no))].forEach(g => Object.assign(totals, bestBallState(round, players, scores, g).totals));
  return totals;
}

function vegasNumber(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return hi >= 10 ? Number("" + hi + lo) : Number("" + lo + hi);
}

function vegasState(round, players, scores, groupNo) {
  const t = teamsOf(players, groupNo);
  const out = { valid: t.valid, teams: t, totals: {}, holes: {} };
  players.filter(p => p.group_no === groupNo).forEach(p => (out.totals[p.id] = 0));
  if (!t.valid) return out;
  const allow = holeAllowances(round, players);
  const val = x => Math.max(1, Math.round(netOf(x, allow)));
  const scoreOf = (p, h) => scores.find(x => x.player_id === p.id && x.hole === h && x.strokes);
  for (let h = 1; h <= 18; h++) {
    const s1 = t[1].map(p => scoreOf(p, h)), s2 = t[2].map(p => scoreOf(p, h));
    if ([...s1, ...s2].some(x => !x)) { out.holes[h] = null; continue; }
    const a = s1.map(val), b = s2.map(val);
    const n1 = vegasNumber(a[0], a[1]), n2 = vegasNumber(b[0], b[1]);
    const winner = n1 < n2 ? 1 : n2 < n1 ? 2 : 0, diff = Math.abs(n1 - n2);
    if (winner) t[winner].forEach(p => (out.totals[p.id] += diff));
    out.holes[h] = { winner, diff, num: { 1: n1, 2: n2 }, parts: { 1: a, 2: b } };
  }
  return out;
}

function vegasTotals(round, players, scores) {
  const totals = {};
  [...new Set(players.map(p => p.group_no))].forEach(g => Object.assign(totals, vegasState(round, players, scores, g).totals));
  return totals;
}
