// ---------- Wolf ----------
// [wolf side wins, each opponent when they win]
const WOLF_PTS = { partner: [2, 3], lone: [4, 1], blind: [6, 2] };   // groups of 4
const WOLF_PTS3 = { partner: [1, 3], lone: [4, 1], blind: [6, 2] };  // groups of 3

function wolfState(round, players, scores, picks, groupNo) {
  const order = players.filter(p => p.group_no === groupNo)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  const n = order.length;
  const out = { totals: {}, holes: {}, valid: n === 3 || n === 4 };
  order.forEach(p => (out.totals[p.id] = 0));
  if (!out.valid) return out;
  const table = n === 3 ? WOLF_PTS3 : WOLF_PTS;
  const allow = holeAllowances(round, players);
  const scoreOf = (id, h) => scores.find(x => x.player_id === id && x.hole === h && x.strokes);
  for (let h = 1; h <= 18; h++) {
    const lastPlaceRule = n === 4 && h >= 17;
    const wolf = lastPlaceRule
      ? order.slice().sort((a, b) => out.totals[a.id] - out.totals[b.id] || order.indexOf(a) - order.indexOf(b))[0]
      : order[(h - 1) % n];
    const tee = lastPlaceRule
      ? order.filter(p => p !== wolf).concat(wolf)
      : Array.from({ length: n - 1 }, (_, k) => order[(h + k) % n]).concat(wolf);
    const pick = picks.find(x => x.group_no === groupNo && x.hole === h) || null;
    const info = { wolf, tee, pick, result: null };
    out.holes[h] = info;
    if (order.some(p => !scoreOf(p.id, h))) continue;
    if (!pick) { info.result = { kind: "nopick" }; continue; }
    const net = id => netOf(scoreOf(id, h), allow);
    const teamA = pick.kind === "partner" ? [pick.wolf_id, pick.partner_id] : [pick.wolf_id];
    const teamB = order.map(p => p.id).filter(id => !teamA.includes(id));
    const a = Math.min(...teamA.map(net)), b = Math.min(...teamB.map(net));
    const [win, opp] = table[pick.kind];
    if (a < b) { teamA.forEach(id => (out.totals[id] += win)); info.result = { kind: "won", ids: teamA, pts: win }; }
    else if (b < a) { teamB.forEach(id => (out.totals[id] += opp)); info.result = { kind: "won", ids: teamB, pts: opp }; }
    else info.result = { kind: "push" };
  }
  return out;
}

function wolfTotals(round, players, scores, picks) {
  const totals = {};
  [...new Set(players.map(p => p.group_no))].forEach(g => Object.assign(totals, wolfState(round, players, scores, picks, g).totals));
  return totals;
}
