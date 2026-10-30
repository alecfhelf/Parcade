// ---------- Sixes (Round Robin / Hollywood) ----------
// 4 players, A B C D in room order. Partners rotate every third of the round, so everyone teams up with everyone once.
// Each third is its own best-ball match worth 1 point to each winner, half a point each when it's tied.
// With Nassau bets on (18 holes only), each third is three match-play bets instead: Front (its first 3 holes), Back (its
// last 3) and Overall (all 6), with optional presses, a gross birdie bonus and a second-ball tiebreak. The match and press
// logic is Nassau's (nassau.js).
const SX_NASSAU = typeof module !== "undefined" ? require("./nassau.js")
  : { nassauMatch, nassauPlayHole, nassauSettle }; // nassau.js loads first in index.html
const SIXES_PAIRS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

// Which third (0, 1, 2) a hole falls in. hole is a hole number and start is the hole the round started on, so a round
// that starts on 10 counts 10 as its first hole. Parcade's swapped courses already renumber holes in play order (start 1).
function sixesSegment(hole, holes = 18, start = 1) {
  const pos = ((hole - start) % holes + holes) % holes;
  return Math.floor(pos / (holes / 3));
}

// [first, last] play position of a segment: [1, 6], [7, 12], [13, 18], or [1, 3], [4, 6], [7, 9] for 9 holes
function sixesSegHoles(seg, holes = 18) {
  const n = holes / 3;
  return [seg * n + 1, seg * n + n];
}

// The two teams in a segment, as [[A, B], [C, D]] picked out of order
function sixesTeams(order, seg) {
  return SIXES_PAIRS[seg].map(side => side.map(i => order[i]));
}

// One hole: lower best net ball wins. Returns 1, 2 or 0 for a halve. nets: [[team 1 nets], [team 2 nets]]
// secondBall: tied best balls go to the lower other ball, and it's only halved when those tie too.
function sixesHoleWinner(nets, secondBall) {
  const a = Math.min(...nets[0]), b = Math.min(...nets[1]);
  if (a !== b || !secondBall) return a < b ? 1 : b < a ? 2 : 0;
  const a2 = Math.max(...nets[0]), b2 = Math.max(...nets[1]);
  return a2 < b2 ? 1 : b2 < a2 ? 2 : 0;
}

// Nassau bets only fit 6-hole segments, so a 9-hole card plays plain Sixes (one Overall per segment)
const sixesNassauOn = (opts, holes) => !!(opts && opts.nassau) && holes === 18;

// Whole round. order: 4 player ids (A-D). net(id, hole) and gross(id, hole) give a score or null if not entered.
// Holes are play positions 1..holes. final: the round is over, so a part-played segment is settled on what was played.
// opts: { nassau, presses, birdie, secondBall, par(hole) }. With Nassau bets each segment gets bets (front, back, overall,
// then presses in the order they started, as Nassau matches) and birdies ([{ hole, team }]), and points come from those.
function sixesScore(order, holes, net, gross, final, opts) {
  const nassau = sixesNassauOn(opts, holes);
  const out = { nassau, holes: {}, segs: [], points: {}, holesWon: {}, strokes: {}, standings: [] };
  order.forEach(id => { out.points[id] = 0; out.holesWon[id] = 0; out.strokes[id] = 0; });
  for (let h = 1; h <= holes; h++) order.forEach(id => { const g = gross(id, h); if (g) out.strokes[id] += g; });
  for (let seg = 0; seg < 3; seg++) {
    const teams = sixesTeams(order, seg), [lo, hi] = sixesSegHoles(seg, holes);
    const s = { seg, teams, range: [lo, hi], won: { 1: 0, 2: 0 }, played: 0, winner: null };
    if (nassau) {
      s.bets = [SX_NASSAU.nassauMatch("front", 0, [lo, lo + 2]), SX_NASSAU.nassauMatch("back", 1, [lo + 3, hi]), SX_NASSAU.nassauMatch("overall", null, [lo, hi])];
      s.birdies = [];
    }
    for (let h = lo; h <= hi; h++) {
      const nets = teams.map(t => t.map(id => net(id, h)));
      if (nets.flat().some(v => v == null)) { out.holes[h] = { seg, teams, winner: null, presses: [], birdies: [] }; continue; }
      const winner = sixesHoleWinner(nets, nassau && opts.secondBall);
      const best = { 1: Math.min(...teams[0].map(id => gross(id, h))), 2: Math.min(...teams[1].map(id => gross(id, h))) };
      const bestNet = { 1: Math.min(...nets[0]), 2: Math.min(...nets[1]) };
      const hole = out.holes[h] = { seg, teams, winner, best, bestNet, presses: [], birdies: [] };
      if (winner && bestNet[1] === bestNet[2]) hole.secondBall = true;
      s.played++;
      if (winner) { s.won[winner]++; teams[winner - 1].forEach(id => out.holesWon[id]++); }
      if (!nassau) continue;
      // Presses: 2 down in the Front, Back or Overall starts one on the next hole, to the end of that bet
      hole.presses = SX_NASSAU.nassauPlayHole(s.bets, h, winner, opts.presses ? () => true : null);
      // Birdie bonus: a gross birdie (or better) on the team, net doesn't count
      const par = opts.birdie && opts.par ? opts.par(h) : null;
      if (par) [1, 2].forEach(t => { if (best[t] <= par - 1) { hole.birdies.push(t); s.birdies.push({ hole: h, team: t }); } });
    }
    const n = hi - lo + 1;
    if (s.played === n || (final && s.played > 0)) s.winner = s.won[1] > s.won[2] ? 1 : s.won[2] > s.won[1] ? 2 : 0;
    if (nassau) {
      SX_NASSAU.nassauSettle(s.bets, final);
      s.bets.forEach(m => {
        if (m.winner) teams[m.winner - 1].forEach(id => out.points[id] += 1);
        else if (m.winner === 0) order.forEach(id => out.points[id] += 0.5);
      });
      s.birdies.forEach(b => teams[b.team - 1].forEach(id => out.points[id] += 1));
    } else if (s.winner) teams[s.winner - 1].forEach(id => out.points[id] += 1);
    else if (s.winner === 0) order.forEach(id => out.points[id] += 0.5);
    // Clinched: the trailing team can't catch up with what's left
    const left = n - s.played;
    s.clinched = s.winner == null && Math.abs(s.won[1] - s.won[2]) > left ? (s.won[1] > s.won[2] ? 1 : 2) : null;
    out.segs.push(s);
  }
  out.standings = sixesRank(order, out);
  return out;
}

// Per-point money with Nassau bets: every bet, press and birdie is worth rate from the other team. Each one is won by
// a pair from the other pair (or halved), so a player's money is rate × (2 × their points − all points in the group ÷ 2).
function sixesMoney(points, rate) {
  const ids = Object.keys(points), sum = ids.reduce((a, id) => a + points[id], 0), out = {};
  ids.forEach(id => (out[id] = rate * (2 * points[id] - sum / 2)));
  return out;
}

// Points, then holes won across all three segments, then fewest strokes. Equal on all three shares a place.
function sixesRank(order, sc) {
  const cmp = (a, b) => sc.points[b] - sc.points[a] || sc.holesWon[b] - sc.holesWon[a] || sc.strokes[a] - sc.strokes[b];
  const sorted = order.slice().sort(cmp);
  let place = 0;
  return sorted.map((id, i) => {
    if (i > 0 && cmp(sorted[i - 1], id) !== 0) place = i;
    return { id, place, points: sc.points[id], holesWon: sc.holesWon[id], strokes: sc.strokes[id] };
  });
}

// ---- Browser side: rounds, players and scores (uses holeAllowances, netOf and holesIn from app.js) ----
function sixesOrder(players, groupNo) {
  return players.filter(p => p.group_no === groupNo && p.role !== "caddy")
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

// Nassau bets settings on the round, and pars for the birdie bonus: the course card, else the round's mini-golf card,
// else round.sixes_pars (seasons fill that in, since they don't load courses alongside rounds)
function sixesOpts(round, course) {
  const pars = (course && course.pars) || (round.mini_course && round.mini_course.pars) || round.sixes_pars || null;
  return { nassau: !!round.sixes_nassau, presses: !!round.sixes_presses, birdie: !!round.sixes_birdie, secondBall: !!round.sixes_second_ball,
    par: h => (Array.isArray(pars) && Number(pars[h - 1])) || null };
}

function sixesState(round, players, scores, groupNo, final, course) {
  const order = sixesOrder(players, groupNo);
  const holes = holesIn(round);
  const valid = order.length === 4;
  const byId = {};
  order.forEach(p => (byId[p.id] = p));
  if (!valid) return { valid, nassau: false, order, byId, holes: {}, segs: [], points: {}, holesWon: {}, strokes: {}, standings: [], count: holes };
  const allow = holeAllowances(round, players);
  const scoreOf = (id, h) => scores.find(x => x.player_id === id && x.hole === h && x.strokes);
  const sc = sixesScore(order.map(p => p.id), holes,
    (id, h) => { const x = scoreOf(id, h); return x ? netOf(x, allow) : null; },
    (id, h) => { const x = scoreOf(id, h); return x ? x.strokes : null; }, final, sixesOpts(round, course));
  return { valid, nassau: sc.nassau, order, byId, holes: sc.holes, segs: sc.segs, points: sc.points, holesWon: sc.holesWon, strokes: sc.strokes, standings: sc.standings, count: holes };
}

function sixesTotals(round, players, scores, final, course) {
  const totals = {};
  [...new Set(players.map(p => p.group_no))].forEach(g => Object.assign(totals, sixesState(round, players, scores, g, final, course).points));
  return totals;
}

// Rank value for pots and seasons: higher is better, tiebreaks folded in, fully tied players share it
function sixesRankValues(round, players, scores, final, course) {
  const v = {};
  [...new Set(players.map(p => p.group_no))].forEach(g => {
    sixesState(round, players, scores, g, final, course).standings.forEach(r => { v[r.id] = r.points * 1e6 + r.holesWon * 1e3 - r.strokes; });
  });
  return v;
}

// Per-bet money override for moneyNet, or null when it's per point without Nassau bets (or not per point at all)
function sixesRoundMoney(round, players, scores, course) {
  if (round.stakes !== "point" || !sixesNassauOn(sixesOpts(round), holesIn(round))) return null;
  const out = {};
  [...new Set(players.map(p => p.group_no))].forEach(g => {
    const st = sixesState(round, players, scores, g, true, course);
    if (st.valid) Object.assign(out, sixesMoney(st.points, Number(round.per_point || 0)));
  });
  return out;
}

// Team names in a segment: ["Alec & Sam", "Jo & Kim"]
const sixesNames = (s, byId) => s.teams.map(t => t.map(id => (byId[id] || {}).name || "?").join(" & "));

// Nassau bets in a segment as [label, status] rows: ["Front", "Alec & Sam 1 UP"], ["Back", "—"] before it starts.
// Presses follow the three main bets: all of them, or with liveOnly just the ones still being played.
function sixesBetRows(st, seg, liveOnly) {
  const s = st.segs[seg], names = sixesNames(s, st.byId);
  return s.bets.filter((m, i) => i < 3 || !liveOnly || m.winner == null)
    .map(m => [nassauLabel(m), m.played || m.winner != null ? nassauStatusText(m, names) : "\u2014"]);
}
// "Front: Alec & Sam 1 UP · Back: — · Overall: Alec & Sam 1 UP", with any live presses after
const sixesBetsText = (st, seg) => sixesBetRows(st, seg, true).map(r => r.join(": ")).join(" \u00B7 ");
// Birdie bonuses in a segment as [label, who] rows
function sixesBirdieRows(st, seg) {
  const s = st.segs[seg], names = sixesNames(s, st.byId);
  return s.birdies.map(b => ["Birdie, hole " + b.hole, names[b.team - 1] + " +1 each"]);
}

// "Alec & Sam vs Jo & Kim"
function sixesTeamsText(teams, byId) {
  const nm = t => t.map(id => (byId[id] || {}).name || "?").join(" & ");
  return nm(teams[0]) + " vs " + nm(teams[1]);
}

const sixesPts = n => (n % 1 ? (n === 0.5 ? "½" : Math.floor(n) + "½") : String(n));

if (typeof module !== "undefined") module.exports = { SIXES_PAIRS, sixesSegment, sixesSegHoles, sixesTeams, sixesHoleWinner, sixesScore, sixesRank, sixesMoney, sixesPts };
