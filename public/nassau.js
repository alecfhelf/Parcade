// ---------- Nassau ----------
// Three match-play bets in one 18: the Front 9, the Back 9 and the Overall. 2 players play singles, 4 play 2 vs 2 best ball.
// Each bet is worth 1 point to each winner, half a point each when it's halved. With presses on, a side that goes 2 down
// in a nine (or in a press) starts a new 1-point press on the next hole that runs to the end of that nine.

// Hole number at play position pos (1..18). start is the hole the round started on. Parcade's swapped courses already
// renumber holes in play order, so the app always passes start 1.
const nassauHoleAt = (pos, start = 1) => ((start - 1 + pos - 1) % 18) + 1;

// One hole: lower best net ball wins. Returns 1, 2 or 0 for a halve. nets: [[side 1 nets], [side 2 nets]]
function nassauHoleWinner(nets) {
  const a = Math.min(...nets[0]), b = Math.min(...nets[1]);
  return a < b ? 1 : b < a ? 2 : 0;
}

// key: "front", "back", "overall" or "press". range: [first, last] play position. nine: 0 front, 1 back, null overall.
function nassauMatch(key, nine, range, extra) {
  return { key, nine, range, up: 0, played: 0, winner: null, result: null, pressed: { 1: false, 2: false }, ...extra };
}

// One played hole at play position pos for a list of bets ms. winner is 1, 2 or 0 for a halve. Every unsettled bet that
// covers pos moves, and one that can't be caught any more is settled. canPress(m) says whether bet m can be pressed (null
// for no presses): a side 2 down in it starts a press on the next hole that runs to the end of m, once per side per bet.
// Returns the indexes in ms of presses that started.
function nassauPlayHole(ms, pos, winner, canPress) {
  const live = ms.filter(m => pos >= m.range[0] && pos <= m.range[1]);
  live.forEach(m => {
    if (m.winner != null) return;
    m.played++;
    m.up += winner === 1 ? 1 : winner === 2 ? -1 : 0;
    const n = m.range[1] - m.range[0] + 1, lead = Math.abs(m.up), left = n - m.played;
    if (lead > left) { m.winner = m.up > 0 ? 1 : 2; m.result = left ? lead + " & " + left : lead + " UP"; }
    else if (!left) { m.winner = 0; m.result = "Halved"; }
  });
  const started = [];
  if (canPress) live.forEach(m => {
    const by = m.up === 2 ? 2 : m.up === -2 ? 1 : 0;
    if (!canPress(m) || !by || m.pressed[by] || pos >= m.range[1]) return;
    m.pressed[by] = true;
    ms.push(nassauMatch("press", m.nine, [pos + 1, m.range[1]], { parent: ms.indexOf(m), by }));
    started.push(ms.length - 1);
  });
  return started;
}

// final: the round is over, so a part-played bet is settled on what was played
function nassauSettle(ms, final) {
  ms.forEach(m => {
    if (m.winner != null || !final || !m.played) return;
    m.winner = m.up > 0 ? 1 : m.up < 0 ? 2 : 0;
    m.result = m.up ? Math.abs(m.up) + " UP" : "Halved";
  });
}

// Whole round. sides: [[ids], [ids]], one id each for singles or two for a team. net(id, hole) and gross(id, hole) give a
// score or null if not entered. opts: { presses, start, final }. final: the round is over, so a part-played bet is settled
// on what was played.
// matches: front, back, overall, then presses in the order they started. up is side 1's lead (negative when side 2 leads).
function nassauScore(sides, net, gross, opts = {}) {
  const start = opts.start || 1, ids = sides.flat();
  const out = { sides, holes: {}, matches: [], points: {}, holesWon: {}, strokes: {}, standings: [] };
  ids.forEach(id => { out.points[id] = 0; out.holesWon[id] = 0; out.strokes[id] = 0; });
  const ms = out.matches;
  ms.push(nassauMatch("front", 0, [1, 9]), nassauMatch("back", 1, [10, 18]), nassauMatch("overall", null, [1, 18]));
  for (let pos = 1; pos <= 18; pos++) {
    const h = nassauHoleAt(pos, start);
    ids.forEach(id => { const g = gross(id, h); if (g) out.strokes[id] += g; });
    const nets = sides.map(s => s.map(id => net(id, h)));
    if (nets.flat().some(v => v == null)) { out.holes[h] = { pos, winner: null, presses: [] }; continue; }
    const winner = nassauHoleWinner(nets);
    const best = { 1: Math.min(...sides[0].map(id => gross(id, h))), 2: Math.min(...sides[1].map(id => gross(id, h))) };
    const bestNet = { 1: Math.min(...nets[0]), 2: Math.min(...nets[1]) };
    out.holes[h] = { pos, winner, best, bestNet, presses: [] };
    if (winner) sides[winner - 1].forEach(id => out.holesWon[id]++);
    // Presses: the first time a side goes 2 down in a nine's match or a press, that side starts a new press on the next
    // hole. Each side presses each bet once. The Overall never gets pressed, and presses never change the bets they came from.
    out.holes[h].presses = nassauPlayHole(ms, pos, winner, opts.presses ? m => m.key !== "overall" : null);
  }
  nassauSettle(ms, opts.final);
  ms.forEach(m => {
    if (m.winner) sides[m.winner - 1].forEach(id => (out.points[id] += 1));
    else if (m.winner === 0) ids.forEach(id => (out.points[id] += 0.5));
  });
  out.standings = nassauRank(ids, out);
  return out;
}

// Points, then holes won over the 18, then fewest strokes. Equal on all three shares a place.
function nassauRank(ids, sc) {
  const cmp = (a, b) => sc.points[b] - sc.points[a] || sc.holesWon[b] - sc.holesWon[a] || sc.strokes[a] - sc.strokes[b];
  const sorted = ids.slice().sort(cmp);
  let place = 0;
  return sorted.map((id, i) => {
    if (i > 0 && cmp(sorted[i - 1], id) !== 0) place = i;
    return { id, place, points: sc.points[id], holesWon: sc.holesWon[id], strokes: sc.strokes[id] };
  });
}

// Golf-style status of one bet. names: [side 1, side 2]. "Alec 2 UP", "All square", "Alec wins 3 & 2", "Alec & Jo win 1 UP", "Halved"
function nassauStatusText(m, names) {
  if (m.winner === 0) return "Halved";
  if (m.winner) return names[m.winner - 1] + (names[m.winner - 1].includes(" & ") ? " win " : " wins ") + m.result;
  if (!m.up) return "All square";
  const n = m.range[1] - m.range[0] + 1, lead = Math.abs(m.up);
  return names[m.up > 0 ? 0 : 1] + " " + lead + " UP" + (lead === n - m.played ? ", dormie" : "");
}

// "Front", "Back", "Overall", "Press, holes 5–9" or "Press, hole 9"
function nassauLabel(m) {
  if (m.key === "press") return m.range[0] === m.range[1] ? "Press, hole " + m.range[0] : "Press, holes " + m.range[0] + "–" + m.range[1];
  return m.key[0].toUpperCase() + m.key.slice(1);
}

// Each player's money with per_point dollars per bet. Singles is head to head. In 2 vs 2 each player wins or loses
// against the other side, so a $1 Nassau swept 3 bets to 0 is +$3 for each winner and -$3 for each loser.
function nassauMoney(sides, points, rate) {
  const out = {}, avg = s => s.reduce((a, id) => a + points[id], 0) / s.length;
  sides.forEach((s, i) => s.forEach(id => (out[id] = rate * (points[id] - avg(sides[1 - i])))));
  return out;
}

// ---- Browser side: rounds, players and scores (uses holeAllowances, netOf and holesIn from app.js) ----
function nassauOrder(players, groupNo) {
  return players.filter(p => p.group_no === groupNo && p.role !== "caddy")
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

// Nassau with 4 golfers is a team game, so the lobby shows Team A / Team B
const nassauTeamGame = players => players.filter(p => p.role !== "caddy").length === 4;

// [[side 1 players], [side 2 players]] or null when the group can't play Nassau
function nassauSides(order) {
  if (order.length === 2) return [[order[0]], [order[1]]];
  if (order.length !== 4) return null;
  const t1 = order.filter(p => p.team === 1), t2 = order.filter(p => p.team === 2);
  return t1.length === 2 && t2.length === 2 ? [t1, t2] : null;
}

function nassauState(round, players, scores, groupNo, final) {
  const order = nassauOrder(players, groupNo);
  const sides = holesIn(round) === 18 ? nassauSides(order) : null;
  const byId = {};
  order.forEach(p => (byId[p.id] = p));
  const names = sides ? sides.map(s => s.map(p => p.name).join(" & ")) : [];
  if (!sides) return { valid: false, order, byId, names, sides: [], holes: {}, matches: [], points: {}, holesWon: {}, strokes: {}, standings: [] };
  const allow = holeAllowances(round, players);
  const scoreOf = (id, h) => scores.find(x => x.player_id === id && x.hole === h && x.strokes);
  const sc = nassauScore(sides.map(s => s.map(p => p.id)),
    (id, h) => { const x = scoreOf(id, h); return x ? netOf(x, allow) : null; },
    (id, h) => { const x = scoreOf(id, h); return x ? x.strokes : null; },
    { presses: !!round.nassau_presses, final });
  return { valid: true, order, byId, names, ...sc };
}

const nassauGroups = players => [...new Set(players.map(p => p.group_no))];

function nassauTotals(round, players, scores, final) {
  const totals = {};
  nassauGroups(players).forEach(g => Object.assign(totals, nassauState(round, players, scores, g, final).points));
  return totals;
}

// Rank value for pots and seasons: higher is better, tiebreaks folded in, fully tied players share it
function nassauRankValues(round, players, scores, final) {
  const v = {};
  nassauGroups(players).forEach(g => {
    nassauState(round, players, scores, g, final).standings.forEach(r => { v[r.id] = r.points * 1e6 + r.holesWon * 1e3 - r.strokes; });
  });
  return v;
}

// Per-bet money override for moneyNet, or null when the round isn't played per point
function nassauRoundMoney(round, players, scores) {
  if (round.stakes !== "point") return null;
  const out = {};
  nassauGroups(players).forEach(g => {
    const st = nassauState(round, players, scores, g, true);
    if (st.valid) Object.assign(out, nassauMoney(st.sides, st.points, Number(round.per_point || 0)));
  });
  return out;
}

// Live lines, one per bet: "Front: Alec 2 UP". Presses show up once they've been called.
function nassauStatusLines(st) {
  return st.matches.map(m => nassauLabel(m) + ": " + nassauStatusText(m, st.names));
}

if (typeof module !== "undefined") module.exports = { nassauHoleAt, nassauHoleWinner, nassauMatch, nassauPlayHole, nassauSettle, nassauScore, nassauRank, nassauStatusText, nassauLabel, nassauMoney };
