// ---------- Tournament logic (pure: no DOM, testable with plain Node) ----------
// In the browser, vegasNumber (teams.js) and settleUp (money.js) are globals. In Node we require them.
const TC_DEPS = typeof window === "undefined" && typeof module !== "undefined"
  ? Object.assign({}, require("./teams.js"), require("./money.js")) : null;
const tcVegasNumber = (a, b) => (TC_DEPS ? TC_DEPS.vegasNumber : vegasNumber)(a, b);
const tcSettleUp = net => (TC_DEPS ? TC_DEPS.settleUp : settleUp)(net);

const TOURNEY_MODES = ["party", "stroke", "skins", "match", "bbb", "bestball", "vegas", "wolf"];
const tcSum = a => a.reduce((x, y) => x + y, 0);

// ---------- Bracket shape ----------
function bracketRounds(teamCount) {
  let r = 0;
  while ((1 << r) < teamCount) r++;
  return r;
}

// Standard seed order: 1 v 16, 8 v 9, 4 v 13, 5 v 12, ... read in pairs
function bracketOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap(s => [s, n + 1 - s]);
  }
  return order;
}

// Round-1 slots as seed numbers. b is null when the top seed in that slot gets a bye.
function buildBracket(teamCount) {
  const size = 1 << bracketRounds(teamCount);
  const order = bracketOrder(size);
  const slots = [];
  for (let i = 0; i < size / 2; i++) {
    const a = order[2 * i], b = order[2 * i + 1];
    slots.push({ slot: i, a, b: b > teamCount ? null : b });
  }
  return slots;
}

// Hole counts per bracket round for the one-day schedule. Extra holes go to the later rounds.
function segments(rounds) {
  const base = Math.floor(18 / rounds), extra = 18 % rounds;
  return Array.from({ length: rounds }, (_, i) => base + (i >= rounds - extra ? 1 : 0));
}

function segmentHoles(rounds) {
  let next = 1;
  return segments(rounds).map(n => Array.from({ length: n }, () => next++));
}

// Holes a match is played over. roundNo is 1-based. The 3rd-place match uses the final's holes.
function matchHoles(t, rounds, roundNo, isThird) {
  if (t.schedule === "one_day") return segmentHoles(rounds)[(isThird ? rounds : roundNo) - 1];
  return Array.from({ length: t.holes_per_match === 9 ? 9 : 18 }, (_, i) => i + 1);
}

function roundName(rounds, roundNo) {
  const left = 1 << (rounds - roundNo + 1);
  return { 2: "Championship", 4: "Final Four", 8: "Elite 8", 16: "Sweet 16" }[left] || "Round of " + left;
}

// ---------- Handicaps ----------
// Same numbers as holeAllowances + strokesOn in app.js, with the base taken from the whole tournament.
const usualOf = m => (m.usual_score != null ? Number(m.usual_score) : m.hcp != null ? Math.round(72 + Number(m.hcp)) : null);
const hcpOf = m => (m.hcp != null ? Number(m.hcp) : m.usual_score != null ? Number(m.usual_score) - 72 : 0);

function strokesTotal(usual, baseUsual) {
  if (usual == null || baseUsual == null) return 0;
  return Math.max(0, Math.round(usual - baseUsual));
}

function strokesOnHole(total, hole, ranks) {
  if (Array.isArray(ranks) && ranks.length === 18) {
    const rank = Number(ranks[hole - 1]);
    return total >= rank ? Math.floor((total - rank) / 18) + 1 : 0;
  }
  const a = total / 18;
  return Math.floor(hole * a + 1e-9) - Math.floor((hole - 1) * a + 1e-9);
}

// ---------- Team scoring ----------
const HIGHER_WINS = { party: true, bbb: true, skins: true, match: true, vegas: true };
const BEST_BALL_LIKE = ["bestball", "match", "skins"];

// One team's number on one hole, lower is better. Used by modes that compare holes and by the card-off.
function teamHoleValue(mode, nets) {
  const sorted = nets.slice().sort((x, y) => x - y);
  if (BEST_BALL_LIKE.includes(mode)) return sorted[0];
  if (mode === "vegas" && sorted.length > 2) return sorted[0] + sorted[1];
  return tcSum(sorted);
}

// opts: { mode, holes, teamA: [pid], teamB: [pid], gross(pid, hole) -> strokes or null, strokes(pid, hole) -> int,
//         awards: [{ winner_id, hole, points, award }], challenges: bool, ranks, hcpA, hcpB, seedA, seedB, tiebreak }
// Returns { a, b, higherWins, holesDone, final, winner: "a" | "b" | null, tiebreak, needsPlayoff }
function matchResult(opts) {
  const { holes, teamA, teamB } = opts;
  const mode = opts.mode === "vegas" && teamA.length === 1 ? "stroke" : opts.mode === "wolf" ? "stroke" : opts.mode;
  const strokes = opts.strokes || (() => 0);
  const net = (pid, h) => { const g = opts.gross(pid, h); return g == null ? null : g - strokes(pid, h); };
  const done = (team, h) => team.every(pid => opts.gross(pid, h) != null);
  const nets = (team, h) => team.map(pid => net(pid, h));
  const both = h => done(teamA, h) && done(teamB, h);
  const inA = new Set(teamA), inB = new Set(teamB), holeSet = new Set(holes);
  let a = 0, b = 0;

  if (mode === "stroke") {
    holes.forEach(h => teamA.concat(teamB).forEach(pid => {
      const n = net(pid, h);
      if (n == null) return;
      if (inA.has(pid)) a += n; else b += n;
    }));
  } else if (mode === "bestball") {
    holes.forEach(h => {
      if (done(teamA, h)) a += Math.min(...nets(teamA, h));
      if (done(teamB, h)) b += Math.min(...nets(teamB, h));
    });
  } else if (mode === "vegas") {
    const val = n => Math.max(1, Math.round(n));
    const num = team => { const v = team.slice().sort((x, y) => x - y).slice(0, 2).map(val); return tcVegasNumber(v[0], v[1]); };
    holes.forEach(h => {
      if (!both(h)) return;
      const na = num(nets(teamA, h)), nb = num(nets(teamB, h));
      if (na < nb) a += nb - na; else if (nb < na) b += na - nb;
    });
  } else if (mode === "match") {
    holes.forEach(h => {
      if (!both(h)) return;
      const na = Math.min(...nets(teamA, h)), nb = Math.min(...nets(teamB, h));
      if (na < nb) a++; else if (nb < na) b++;
    });
  } else if (mode === "skins") {
    let carry = 0;
    holes.forEach(h => {
      const pot = carry + 1;
      if (!both(h)) { carry = pot; return; }
      const na = Math.min(...nets(teamA, h)), nb = Math.min(...nets(teamB, h));
      if (na < nb) { a += pot; carry = 0; } else if (nb < na) { b += pot; carry = 0; } else carry = pot;
    });
  } else if (mode === "party") {
    // Hole points from Party Mode: 1 for finishing plus 1 per player (from both teams) with a worse net
    const all = teamA.concat(teamB);
    holes.forEach(h => all.forEach(pid => {
      const n = net(pid, h);
      if (n == null) return;
      const pts = 1 + all.filter(o => { const on = net(o, h); return on != null && on > n; }).length;
      if (inA.has(pid)) a += pts; else b += pts;
    }));
    if (opts.challenges) (opts.awards || []).forEach(r => {
      if (r.award || !holeSet.has(r.hole)) return;
      if (inA.has(r.winner_id)) a += Number(r.points) || 0;
      else if (inB.has(r.winner_id)) b += Number(r.points) || 0;
    });
  } else if (mode === "bbb") {
    (opts.awards || []).forEach(r => {
      if (!r.award || !holeSet.has(r.hole)) return;
      if (inA.has(r.winner_id)) a++; else if (inB.has(r.winner_id)) b++;
    });
  }

  const holesDone = holes.filter(both).length;
  const final = teamA.length > 0 && teamB.length > 0 && holesDone === holes.length;
  const higherWins = !!HIGHER_WINS[mode];
  const out = { a, b, higherWins, holesDone, final, winner: null, tiebreak: null, needsPlayoff: false };
  if (!final) return out;
  if (a !== b) { out.winner = (higherWins ? a > b : a < b) ? "a" : "b"; return out; }
  if (opts.tiebreak === "playoff") { out.needsPlayoff = true; return out; }
  const cmp = cardOff({ mode, holes, ranks: opts.ranks, valueA: h => teamHoleValue(mode, nets(teamA, h)),
    valueB: h => teamHoleValue(mode, nets(teamB, h)), hcpA: opts.hcpA, hcpB: opts.hcpB, seedA: opts.seedA, seedB: opts.seedB });
  out.winner = cmp.winner;
  out.tiebreak = cmp;
  return out;
}

// Card-off: net on the hardest hole (by hole handicap), then the next hardest. No hole handicaps: last hole backward.
// Still tied: lower combined team handicap, then the better seed.
function cardOff({ holes, ranks, valueA, valueB, hcpA, hcpB, seedA, seedB }) {
  const ranked = Array.isArray(ranks) && ranks.length === 18;
  const order = ranked ? holes.slice().sort((x, y) => Number(ranks[x - 1]) - Number(ranks[y - 1])) : holes.slice().reverse();
  for (const h of order) {
    const va = valueA(h), vb = valueB(h);
    if (va !== vb) {
      return { winner: va < vb ? "a" : "b", how: "hole", hole: h,
        text: "Card-off on hole " + h + (ranked ? " (handicap " + ranks[h - 1] + ")" : "") };
    }
  }
  if (hcpA != null && hcpB != null && Number(hcpA) !== Number(hcpB)) {
    return { winner: Number(hcpA) < Number(hcpB) ? "a" : "b", how: "handicap", text: "Card-off tied on every hole. Lower team handicap wins." };
  }
  return { winner: (seedA || 99) <= (seedB || 99) ? "a" : "b", how: "seed", text: "Dead even. Better seed advances." };
}

// ---------- The whole bracket ----------
// matches: rows from tournament_matches. resultFor(match, teamA, teamB) -> matchResult output or null.
// Returns Map match.id -> { match, teamA, teamB, result, winner, loser, status }
// status: "waiting" (teams not known yet), "ready", "live", "final", "bye"
function deriveBracket(rounds, matches, resultFor) {
  const out = new Map();
  const at = (r, s) => matches.find(m => m.round_no === r && m.slot === s && !m.is_third_place);
  const get = m => (m ? out.get(m.id) : null);
  const settle = (m, teamA, teamB) => {
    const d = { match: m, teamA, teamB, result: null, winner: null, loser: null, status: "waiting" };
    if (m.round_no === 1 && teamA && !teamB) { d.status = "bye"; d.winner = teamA; out.set(m.id, d); return; }
    if (!teamA || !teamB) { out.set(m.id, d); return; }
    d.result = resultFor(m, teamA, teamB);
    const r = d.result;
    if (m.override_winner && (m.override_winner === teamA || m.override_winner === teamB)) {
      d.winner = m.override_winner;
      d.status = "final";
      d.overridden = true;
    } else if (r && r.final && r.winner) {
      d.winner = r.winner === "a" ? teamA : teamB;
      d.status = "final";
    } else d.status = r && r.holesDone > 0 ? "live" : (m.started || m.round_id ? "live" : "ready");
    if (d.winner) d.loser = d.winner === teamA ? teamB : teamA;
    out.set(m.id, d);
  };
  for (let r = 1; r <= rounds; r++) {
    matches.filter(m => m.round_no === r && !m.is_third_place).sort((x, y) => x.slot - y.slot).forEach(m => {
      if (r === 1) return settle(m, m.team_a || null, m.team_b || null);
      const fa = get(at(r - 1, 2 * m.slot)), fb = get(at(r - 1, 2 * m.slot + 1));
      settle(m, (fa && fa.winner) || m.team_a || null, (fb && fb.winner) || m.team_b || null);
    });
  }
  const third = matches.find(m => m.is_third_place);
  if (third) {
    const s0 = get(at(rounds - 1, 0)), s1 = get(at(rounds - 1, 1));
    settle(third, (s0 && s0.loser) || third.team_a || null, (s1 && s1.loser) || third.team_b || null);
  }
  return out;
}

// { first, second, third: [teamIds] } with nulls / empty while undecided
function placements(rounds, matches, derived) {
  const fin = matches.find(m => m.round_no === rounds && !m.is_third_place);
  const f = fin && derived.get(fin.id);
  const out = { first: f && f.winner, second: f && f.loser, third: [] };
  const third = matches.find(m => m.is_third_place);
  if (third) {
    const t = derived.get(third.id);
    if (t && t.winner) out.third = [t.winner];
  } else {
    [0, 1].forEach(s => {
      const m = matches.find(x => x.round_no === rounds - 1 && x.slot === s && !x.is_third_place);
      const d = m && derived.get(m.id);
      if (d && d.loser) out.third.push(d.loser);
    });
  }
  return out;
}

// ---------- Building teams ----------
// members: [{ id, hcp }]. Returns teamCount arrays of member ids, lowest-handicap players spread out.
function balanceTeams(members, teamCount, size) {
  const sorted = members.slice().sort((x, y) => hcpOf(x) - hcpOf(y) || String(x.id).localeCompare(String(y.id)))
    .slice(0, teamCount * size);
  const teams = Array.from({ length: teamCount }, () => []);
  sorted.forEach((m, i) => {
    const lap = Math.floor(i / teamCount), pos = i % teamCount;
    teams[lap % 2 ? teamCount - 1 - pos : pos].push(m);
  });
  // Swap pass: keep making the swap that most reduces the spread of team totals
  const total = t => tcSum(t.map(hcpOf));
  for (let pass = 0; pass < 50; pass++) {
    let best = null, bestGain = 1e-9;
    const totals = teams.map(total);
    for (let i = 0; i < teamCount; i++) for (let j = i + 1; j < teamCount; j++) {
      const d = totals[i] - totals[j];
      teams[i].forEach((x, xi) => teams[j].forEach((y, yi) => {
        const delta = hcpOf(x) - hcpOf(y);
        // Change in (ti - tj)^2 when x and y swap
        const gain = d * d - (d - 2 * delta) ** 2;
        if (gain > bestGain) { bestGain = gain; best = [i, xi, j, yi]; }
      }));
    }
    if (!best) break;
    const [i, xi, j, yi] = best;
    [teams[i][xi], teams[j][yi]] = [teams[j][yi], teams[i][xi]];
  }
  return teams.map(t => t.map(m => m.id));
}

function tcShuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor((rand || Math.random)() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomTeams(members, teamCount, size, rand) {
  const teams = Array.from({ length: teamCount }, () => []);
  tcShuffle(members, rand).slice(0, teamCount * size).forEach((m, i) => teams[i % teamCount].push(m.id));
  return teams;
}

// teams: [{ id, hcp (combined), seed }]. Returns Map id -> seed (1 = top).
function seedTeams(teams, method, rand) {
  let order;
  if (method === "random") order = tcShuffle(teams, rand);
  else if (method === "manual") {
    const n = teams.length;
    const valid = teams.every(t => t.seed >= 1 && t.seed <= n) && new Set(teams.map(t => t.seed)).size === n;
    order = valid ? teams.slice().sort((x, y) => x.seed - y.seed) : teams.slice();
  } else order = teams.slice().sort((x, y) => x.hcp - y.hcp || String(x.id).localeCompare(String(y.id)));
  return new Map(order.map((t, i) => [t.id, i + 1]));
}

// ---------- Money ----------
// teams: [{ id, members: [userId] }] (only players on teams pay). payouts: dollars [1st, 2nd, 3rd], same as rounds.payouts.
// place: { first, second, third: [teamIds] }. Returns { pot, net: { userId: { won, total } } } in dollars.
function tournamentPayouts({ teams, buyIn, payouts, place }) {
  const buyC = Math.round(Number(buyIn || 0) * 100);
  const net = {};
  teams.forEach(t => t.members.forEach(u => (net[u] = { won: 0, total: -buyC })));
  const pot = buyC * Object.keys(net).length;
  if (!pot) return { pot: 0, net: {} };
  const teamOf = id => teams.find(t => t.id === id);
  // Hand out cents so everything adds up exactly: remainders go to the first people in line
  const give = (cents, ids) => {
    const people = ids.flatMap(id => (teamOf(id) ? teamOf(id).members : []));
    if (!people.length || !cents) return 0;
    const each = Math.floor(cents / people.length);
    let left = cents - each * people.length;
    people.forEach(u => { const c = each + (left > 0 ? 1 : 0); if (left > 0) left--; net[u].won += c; net[u].total += c; });
    return cents;
  };
  const [c1, c2, c3] = [0, 1, 2].map(i => Math.round(Number((payouts || [])[i] || 0) * 100));
  if (place.first) give(c1, [place.first]);
  if (place.second) give(c2, [place.second]);
  const third = place.third || [];
  if (third.length) {
    const each = Math.floor(c3 / third.length);
    third.forEach((id, i) => give(each + (i === 0 ? c3 - each * third.length : 0), [id]));
  }
  Object.values(net).forEach(x => { x.won /= 100; x.total /= 100; });
  return { pot: pot / 100, net };
}

function tournamentSettle(net) {
  return tcSettleUp(net);
}

if (typeof module !== "undefined") {
  module.exports = {
    TOURNEY_MODES, bracketRounds, bracketOrder, buildBracket, segments, segmentHoles, matchHoles, roundName,
    usualOf, hcpOf, strokesTotal, strokesOnHole, teamHoleValue, matchResult, cardOff, deriveBracket, placements,
    balanceTeams, randomTeams, seedTeams, tournamentPayouts, tournamentSettle,
  };
}
