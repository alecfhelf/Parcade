// Run with: node tests/tournament.test.js
const assert = require("assert");
const T = require("../public/tournament-core.js");
const M = require("../public/money.js");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + e.message); process.exitCode = 1; }
};

// Seeded random so shuffles are repeatable
const rng = seed => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);

// ---------- Bracket generation ----------
[4, 6, 8, 12, 16, 33, 64].forEach(n => {
  test("bracket: " + n + " teams", () => {
    const R = T.bracketRounds(n), size = 1 << R;
    assert.ok(size >= n && size / 2 < n, "bracket size");
    const slots = T.buildBracket(n);
    assert.strictEqual(slots.length, size / 2);
    const seeds = slots.flatMap(s => [s.a, s.b]).filter(Boolean).sort((x, y) => x - y);
    assert.deepStrictEqual(seeds, Array.from({ length: n }, (_, i) => i + 1), "every seed appears once");
    const byes = slots.filter(s => s.b == null).map(s => s.a).sort((x, y) => x - y);
    assert.strictEqual(byes.length, size - n, "bye count");
    assert.deepStrictEqual(byes, Array.from({ length: size - n }, (_, i) => i + 1), "byes go to the top seeds");
    slots.forEach(s => { if (s.b) assert.strictEqual(s.a + s.b, size + 1, "standard pairing"); });
  });
});

test("bracket order: 16 teams reads 1v16, 8v9, 4v13, 5v12, 2v15, 7v10, 3v14, 6v11", () => {
  const pairs = T.buildBracket(16).map(s => s.a + "v" + s.b);
  assert.deepStrictEqual(pairs, ["1v16", "8v9", "4v13", "5v12", "2v15", "7v10", "3v14", "6v11"]);
});

test("bracket: 1 and 2 seeds can only meet in the final", () => {
  [8, 16, 64].forEach(n => {
    const slots = T.buildBracket(n), half = slots.length / 2;
    assert.ok(slots.slice(0, half).some(s => s.a === 1), "1 seed in the top half");
    assert.ok(slots.slice(half).some(s => s.a === 2), "2 seed in the bottom half");
  });
});

// ---------- Hole segmentation ----------
test("segments: examples from the brief", () => {
  assert.deepStrictEqual(T.segments(T.bracketRounds(4)), [9, 9]);
  assert.deepStrictEqual(T.segments(T.bracketRounds(8)), [6, 6, 6]);
  assert.deepStrictEqual(T.segments(T.bracketRounds(16)), [4, 4, 5, 5]);
  assert.deepStrictEqual(T.segments(T.bracketRounds(32)), [3, 3, 4, 4, 4]);
  assert.deepStrictEqual(T.segments(T.bracketRounds(64)), [3, 3, 3, 3, 3, 3]);
});

test("segments: every team count from 4 to 64 covers holes 1-18 once, later rounds never shorter", () => {
  for (let n = 4; n <= 64; n++) {
    const R = T.bracketRounds(n), segs = T.segmentHoles(R);
    assert.strictEqual(segs.length, R);
    assert.deepStrictEqual(segs.flat(), Array.from({ length: 18 }, (_, i) => i + 1), n + " teams");
    for (let i = 1; i < R; i++) assert.ok(segs[i].length >= segs[i - 1].length, n + " teams: extra holes go later");
  }
});

test("matchHoles: third place uses the final's segment, over_time uses 9 or 18", () => {
  assert.deepStrictEqual(T.matchHoles({ schedule: "one_day" }, 3, 3, false), [13, 14, 15, 16, 17, 18]);
  assert.deepStrictEqual(T.matchHoles({ schedule: "one_day" }, 3, 3, true), [13, 14, 15, 16, 17, 18]);
  assert.strictEqual(T.matchHoles({ schedule: "over_time", holes_per_match: 9 }, 3, 1).length, 9);
  assert.strictEqual(T.matchHoles({ schedule: "over_time", holes_per_match: 18 }, 3, 2).length, 18);
});

test("roundName", () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map(r => T.roundName(6, r)),
    ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"]);
  assert.deepStrictEqual([1, 2].map(r => T.roundName(2, r)), ["Final Four", "Championship"]);
});

// ---------- Handicap strokes ----------
test("strokes: tournament-wide base, by hole handicap or spread evenly", () => {
  assert.strictEqual(T.strokesTotal(90, 74), 16);
  assert.strictEqual(T.strokesTotal(74, 74), 0);
  const ranks = [7, 3, 11, 1, 15, 9, 5, 17, 13, 8, 4, 12, 2, 16, 10, 6, 18, 14];
  const byRank = Array.from({ length: 18 }, (_, i) => T.strokesOnHole(4, i + 1, ranks));
  assert.deepStrictEqual(byRank.map((s, i) => (s ? i + 1 : 0)).filter(Boolean), [2, 4, 11, 13]);
  assert.strictEqual(Array.from({ length: 18 }, (_, i) => T.strokesOnHole(20, i + 1, ranks)).reduce((a, b) => a + b), 20);
  const even = Array.from({ length: 18 }, (_, i) => T.strokesOnHole(9, i + 1, null));
  assert.deepStrictEqual(even, [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
});

// ---------- Team scoring per mode ----------
// cards: { pid: [strokes on holes 1..] }
const scoring = (mode, cards, teamA, teamB, extra) => T.matchResult(Object.assign({
  mode, holes: [1, 2, 3], teamA, teamB,
  gross: (pid, h) => (cards[pid] && cards[pid][h - 1] != null ? cards[pid][h - 1] : null),
}, extra || {}));

test("stroke: sum of every player's net, lower wins", () => {
  const r = scoring("stroke", { a1: [4, 4, 4], a2: [5, 5, 5], b1: [3, 4, 5], b2: [6, 6, 6] }, ["a1", "a2"], ["b1", "b2"]);
  assert.strictEqual(r.a, 27); assert.strictEqual(r.b, 30);
  assert.ok(r.final); assert.strictEqual(r.winner, "a");
});

test("stroke: handicap strokes make it net", () => {
  const r = scoring("stroke", { a1: [5, 5, 5], b1: [4, 4, 4] }, ["a1"], ["b1"],
    { strokes: (pid, h) => (pid === "a1" ? (h <= 2 ? 1 : 0) : 0) });
  assert.strictEqual(r.a, 13); assert.strictEqual(r.b, 12); assert.strictEqual(r.winner, "b");
});

test("bestball: best net per hole, summed", () => {
  const r = scoring("bestball", { a1: [4, 6, 5], a2: [5, 3, 5], b1: [4, 4, 4], b2: [7, 7, 7] }, ["a1", "a2"], ["b1", "b2"]);
  assert.strictEqual(r.a, 12); assert.strictEqual(r.b, 12);
  assert.strictEqual(r.tiebreak.how, "hole");
});

test("vegas: two players make a number, winner collects the difference", () => {
  // Hole 1: A 4+5 = 45, B 4+4 = 44 -> B +1. Hole 2: A 3+4 = 34, B 5+6 = 56 -> A +22. Hole 3: A 4+10 = 104, B 5+5 = 55 -> B +49
  const r = scoring("vegas", { a1: [4, 3, 4], a2: [5, 4, 10], b1: [4, 5, 5], b2: [4, 6, 5] }, ["a1", "a2"], ["b1", "b2"]);
  assert.strictEqual(r.a, 22); assert.strictEqual(r.b, 50);
  assert.ok(r.higherWins); assert.strictEqual(r.winner, "b");
});

test("vegas: three players use the best two scores", () => {
  const r = scoring("vegas", { a1: [4, 4, 4], a2: [5, 5, 5], a3: [9, 9, 9], b1: [5, 5, 5], b2: [5, 5, 5], b3: [3, 3, 3] },
    ["a1", "a2", "a3"], ["b1", "b2", "b3"]);
  // A 45 vs B 35 every hole -> B +10 x3
  assert.strictEqual(r.b, 30); assert.strictEqual(r.a, 0);
});

test("vegas: one player per team is a straight stroke match", () => {
  const r = scoring("vegas", { a1: [4, 4, 4], b1: [5, 4, 4] }, ["a1"], ["b1"]);
  assert.strictEqual(r.a, 12); assert.strictEqual(r.b, 13); assert.strictEqual(r.winner, "a"); assert.ok(!r.higherWins);
});

test("match: holes won with each team's best net", () => {
  const r = scoring("match", { a1: [4, 5, 3], a2: [6, 5, 6], b1: [5, 4, 4], b2: [5, 6, 5] }, ["a1", "a2"], ["b1", "b2"]);
  assert.strictEqual(r.a, 2); assert.strictEqual(r.b, 1); assert.strictEqual(r.winner, "a");
});

test("skins: ties carry within the match", () => {
  const r = T.matchResult({ mode: "skins", holes: [1, 2, 3, 4], teamA: ["a"], teamB: ["b"],
    gross: (pid, h) => ({ a: [4, 4, 3, 5], b: [4, 4, 4, 4] })[pid][h - 1] });
  assert.strictEqual(r.a, 3); assert.strictEqual(r.b, 1); assert.strictEqual(r.winner, "a");
});

test("party: hole points across both teams, plus challenges when they count", () => {
  const cards = { a1: [4, 4, 4], a2: [5, 5, 5], b1: [5, 5, 5], b2: [7, 7, 7] };
  // Per hole: a1 = 1 + 3 = 4, a2 = 1 + 1 = 2, b1 = 2, b2 = 1. A 6, B 3 per hole.
  const r = scoring("party", cards, ["a1", "a2"], ["b1", "b2"]);
  assert.strictEqual(r.a, 18); assert.strictEqual(r.b, 9);
  const awards = [{ hole: 2, winner_id: "b2", points: 3 }, { hole: 9, winner_id: "b2", points: 3 }, { hole: 1, winner_id: "a2", points: -1 }];
  const r2 = scoring("party", cards, ["a1", "a2"], ["b1", "b2"], { awards, challenges: true });
  assert.strictEqual(r2.a, 17); assert.strictEqual(r2.b, 12);
  const r3 = scoring("party", cards, ["a1", "a2"], ["b1", "b2"], { awards, challenges: false });
  assert.strictEqual(r3.b, 9);
});

test("bbb: awards on the match's holes, summed by team", () => {
  const cards = { a1: [4, 4, 4], b1: [4, 4, 4] };
  const awards = [
    { hole: 1, winner_id: "a1", award: "bingo" }, { hole: 1, winner_id: "a1", award: "bango" }, { hole: 1, winner_id: "b1", award: "bongo" },
    { hole: 2, winner_id: "b1", award: "bingo" }, { hole: 7, winner_id: "b1", award: "bingo" },
  ];
  const r = scoring("bbb", cards, ["a1"], ["b1"], { awards });
  assert.strictEqual(r.a, 2); assert.strictEqual(r.b, 2);
});

test("wolf teams of 1 play as stroke", () => {
  const r = scoring("wolf", { a1: [4, 4, 4], b1: [4, 4, 5] }, ["a1"], ["b1"]);
  assert.strictEqual(r.winner, "a"); assert.ok(!r.higherWins);
});

test("not final until every player on both teams has every hole", () => {
  const r = scoring("stroke", { a1: [4, 4, 4], b1: [4, 4, null] }, ["a1"], ["b1"]);
  assert.ok(!r.final); assert.strictEqual(r.winner, null); assert.strictEqual(r.holesDone, 2);
});

// ---------- Tiebreaks ----------
test("card-off: hardest hole by hole handicap decides it", () => {
  const ranks = Array(18).fill(0).map((_, i) => i + 1);
  ranks[0] = 5; ranks[1] = 2; ranks[2] = 9; ranks[4] = 1;
  const r = scoring("stroke", { a1: [4, 5, 4], b1: [5, 4, 4] }, ["a1"], ["b1"], { ranks });
  // Hole 2 (handicap 2) is the hardest in the segment. B wins it.
  assert.strictEqual(r.winner, "b"); assert.strictEqual(r.tiebreak.hole, 2);
});

test("card-off: without hole handicaps, last hole backward", () => {
  const r = scoring("stroke", { a1: [5, 4, 4], b1: [4, 5, 4] }, ["a1"], ["b1"]);
  assert.strictEqual(r.winner, "a"); assert.strictEqual(r.tiebreak.hole, 2);
});

test("card-off: every hole equal, lower team handicap wins, then seed", () => {
  const cards = { a1: [4, 4, 4], b1: [4, 4, 4] };
  const r = scoring("stroke", cards, ["a1"], ["b1"], { hcpA: 12, hcpB: 8, seedA: 1, seedB: 2 });
  assert.strictEqual(r.winner, "b"); assert.strictEqual(r.tiebreak.how, "handicap");
  const r2 = scoring("stroke", cards, ["a1"], ["b1"], { hcpA: 8, hcpB: 8, seedA: 3, seedB: 2 });
  assert.strictEqual(r2.winner, "b"); assert.strictEqual(r2.tiebreak.how, "seed");
});

test("playoff tiebreak waits for the creator", () => {
  const r = scoring("stroke", { a1: [4, 4, 4], b1: [4, 4, 4] }, ["a1"], ["b1"], { tiebreak: "playoff" });
  assert.ok(r.final); assert.ok(r.needsPlayoff); assert.strictEqual(r.winner, null);
});

// ---------- Deriving the bracket ----------
// Six teams, seed k = team "t" + k. Lower seed always wins its match.
function sixTeamBracket(third, overrides) {
  const R = T.bracketRounds(6), matches = [];
  T.buildBracket(6).forEach(s => matches.push({ id: "1-" + s.slot, round_no: 1, slot: s.slot, team_a: "t" + s.a, team_b: s.b ? "t" + s.b : null }));
  for (let r = 2; r <= R; r++) for (let s = 0; s < (1 << (R - r)); s++) matches.push({ id: r + "-" + s, round_no: r, slot: s });
  if (third) matches.push({ id: "3rd", round_no: R, slot: 0, is_third_place: true });
  (overrides || []).forEach(([id, w]) => (matches.find(m => m.id === id).override_winner = w));
  const seed = id => +id.slice(1);
  const d = T.deriveBracket(R, matches, (m, a, b) => ({ final: true, holesDone: 1, winner: seed(a) < seed(b) ? "a" : "b" }));
  return { R, matches, d };
}

test("derive: byes advance on their own and winners move up", () => {
  const { R, matches, d } = sixTeamBracket(false);
  assert.strictEqual(d.get("1-0").status, "bye"); assert.strictEqual(d.get("1-0").winner, "t1");
  assert.strictEqual(d.get("1-2").status, "bye");
  assert.strictEqual(d.get("2-0").teamA, "t1"); assert.strictEqual(d.get("2-0").teamB, "t4");
  const p = T.placements(R, matches, d);
  assert.strictEqual(p.first, "t1"); assert.strictEqual(p.second, "t2");
  assert.deepStrictEqual(p.third.sort(), ["t3", "t4"]);
});

test("derive: third-place match and creator overrides", () => {
  const { R, matches, d } = sixTeamBracket(true, [["1-1", "t5"]]);
  assert.strictEqual(d.get("2-0").teamB, "t5");
  assert.ok(d.get("1-1").overridden);
  const p = T.placements(R, matches, d);
  assert.deepStrictEqual(p.third, ["t3"]);
  assert.strictEqual(d.get("3rd").teamA, "t5"); assert.strictEqual(d.get("3rd").teamB, "t3");
});

test("derive: later rounds wait until the feeder is decided", () => {
  const R = 2, matches = [
    { id: "a", round_no: 1, slot: 0, team_a: "t1", team_b: "t4" },
    { id: "b", round_no: 1, slot: 1, team_a: "t2", team_b: "t3" },
    { id: "f", round_no: 2, slot: 0 },
  ];
  const d = T.deriveBracket(R, matches, m => (m.id === "a" ? { final: true, holesDone: 9, winner: "b" } : { final: false, holesDone: 4 }));
  assert.strictEqual(d.get("f").teamA, "t4"); assert.strictEqual(d.get("f").teamB, null);
  assert.strictEqual(d.get("f").status, "waiting"); assert.strictEqual(d.get("b").status, "live");
});

// ---------- Payouts ----------
const teams4 = [
  { id: "A", members: ["a1", "a2"] }, { id: "B", members: ["b1", "b2"] },
  { id: "C", members: ["c1", "c2"] }, { id: "D", members: ["d1", "d2"] },
];
const totalOf = net => Math.round(Object.values(net).reduce((a, x) => a + x.total, 0) * 100) || 0;

test("payouts: with a 3rd-place match", () => {
  const { pot, net } = T.tournamentPayouts({ teams: teams4, buyIn: 20, payouts: [80, 48, 32], place: { first: "A", second: "B", third: ["C"] } });
  assert.strictEqual(pot, 160);
  assert.strictEqual(net.a1.won, 40); assert.strictEqual(net.a1.total, 20);
  assert.strictEqual(net.b1.won, 24); assert.strictEqual(net.b1.total, 4);
  assert.strictEqual(net.c1.won, 16); assert.strictEqual(net.c1.total, -4);
  assert.strictEqual(net.d1.total, -20);
  assert.strictEqual(totalOf(net), 0);
});

test("payouts: no 3rd-place match splits 3rd between both semifinal losers", () => {
  const { net } = T.tournamentPayouts({ teams: teams4, buyIn: 20, payouts: [80, 48, 32], place: { first: "A", second: "B", third: ["C", "D"] } });
  assert.strictEqual(net.c1.won, 8); assert.strictEqual(net.d2.won, 8);
  assert.strictEqual(totalOf(net), 0);
});

test("payouts: odd cents still add up, and settle up balances", () => {
  const teams = [{ id: "A", members: ["a1", "a2", "a3"] }, { id: "B", members: ["b1", "b2", "b3"] },
    { id: "C", members: ["c1", "c2", "c3"] }, { id: "D", members: ["d1", "d2", "d3"] }];
  const { net } = T.tournamentPayouts({ teams, buyIn: 7, payouts: M.potSplit(84, [50, 30, 20]), place: { first: "A", second: "B", third: ["C", "D"] } });
  assert.strictEqual(totalOf(net), 0);
  const moves = T.tournamentSettle(net);
  const bal = {};
  moves.forEach(m => { bal[m.from] = (bal[m.from] || 0) - m.amount; bal[m.to] = (bal[m.to] || 0) + m.amount; });
  Object.entries(net).forEach(([u, x]) => assert.ok(Math.abs((bal[u] || 0) - x.total) < 0.005, u));
});

test("default split: 50 / 30 / 20 in whole dollars, leftover to 1st", () => {
  assert.deepStrictEqual(M.potSplit(160, [50, 30, 20]), [80, 48, 32]);
  assert.deepStrictEqual(M.potSplit(84, [50, 30, 20]), [42, 25, 17]);
  assert.deepStrictEqual(M.potSplit(35, [50, 30, 20]), [17, 11, 7]);
  assert.deepStrictEqual(M.potSplit(130, [50, 30, 20]), [65, 39, 26]);
  [5, 12, 35, 84, 99, 101, 1280, 2560].forEach(pot => {
    const p = M.potSplit(pot, [50, 30, 20]);
    assert.strictEqual(p[0] + p[1] + p[2], pot, "adds up for " + pot);
    assert.ok(p.every(Number.isInteger), "whole dollars for " + pot);
  });
});

test("payouts: a team's place is split evenly between its players", () => {
  const teams = [{ id: "A", members: ["a1", "a2", "a3"] }, { id: "B", members: ["b1", "b2", "b3"] },
    { id: "C", members: ["c1", "c2", "c3"] }, { id: "D", members: ["d1", "d2", "d3"] }];
  const { pot, net } = T.tournamentPayouts({ teams, buyIn: 10, payouts: [60, 36, 24], place: { first: "A", second: "B", third: ["C"] } });
  assert.strictEqual(pot, 120);
  ["a1", "a2", "a3"].forEach(u => assert.strictEqual(net[u].won, 20));
  ["b1", "b2", "b3"].forEach(u => assert.strictEqual(net[u].won, 12));
  assert.strictEqual(totalOf(net), 0);
});

test("payouts: no buy-in means no money", () => {
  const { pot, net } = T.tournamentPayouts({ teams: teams4, buyIn: 0, payouts: null, place: { first: "A" } });
  assert.strictEqual(pot, 0); assert.deepStrictEqual(net, {});
});

// ---------- Building teams ----------
test("balance by handicap: team totals end up close", () => {
  const r = rng(7);
  [[4, 2], [8, 4], [16, 3], [64, 1], [6, 4]].forEach(([n, size]) => {
    const members = Array.from({ length: n * size }, (_, i) => ({ id: "m" + i, hcp: Math.round(r() * 360) / 10 }));
    const teams = T.balanceTeams(members, n, size);
    assert.strictEqual(teams.length, n);
    teams.forEach(t => assert.strictEqual(t.length, size));
    assert.strictEqual(new Set(teams.flat()).size, n * size);
    const hcp = new Map(members.map(m => [m.id, m.hcp]));
    const totals = teams.map(t => t.reduce((a, id) => a + hcp.get(id), 0));
    const spread = Math.max(...totals) - Math.min(...totals);
    if (size > 1) {
      const maxH = Math.max(...members.map(m => m.hcp)), minH = Math.min(...members.map(m => m.hcp));
      assert.ok(spread <= (maxH - minH) / 2, n + "x" + size + " spread " + spread.toFixed(1));
    }
    // Never worse than a plain snake draft
    const snake = Array.from({ length: n }, () => 0);
    members.slice().sort((a, b) => a.hcp - b.hcp).forEach((m, i) => {
      const lap = Math.floor(i / n), pos = i % n;
      snake[lap % 2 ? n - 1 - pos : pos] += m.hcp;
    });
    assert.ok(spread <= Math.max(...snake) - Math.min(...snake) + 1e-9, "beats snake");
  });
});

test("balance by handicap: exact split when one exists", () => {
  const members = [0, 10, 20, 30, 5, 15, 25, 35].map((h, i) => ({ id: "p" + i, hcp: h }));
  const teams = T.balanceTeams(members, 4, 2);
  const hcp = new Map(members.map(m => [m.id, m.hcp]));
  teams.forEach(t => assert.strictEqual(t.reduce((a, id) => a + hcp.get(id), 0), 35));
});

test("random teams fill every team evenly", () => {
  const members = Array.from({ length: 12 }, (_, i) => ({ id: "m" + i }));
  const teams = T.randomTeams(members, 4, 3, rng(3));
  teams.forEach(t => assert.strictEqual(t.length, 3));
  assert.strictEqual(new Set(teams.flat()).size, 12);
});

test("seeding: by handicap, random, manual", () => {
  const teams = [{ id: "A", hcp: 30 }, { id: "B", hcp: 12 }, { id: "C", hcp: 20 }, { id: "D", hcp: 5 }];
  const byHcp = T.seedTeams(teams, "handicap");
  assert.deepStrictEqual(["D", "B", "C", "A"].map(id => byHcp.get(id)), [1, 2, 3, 4]);
  const rand = T.seedTeams(teams, "random", rng(1));
  assert.deepStrictEqual([...rand.values()].sort(), [1, 2, 3, 4]);
  const manual = T.seedTeams(teams.map((t, i) => ({ ...t, seed: 4 - i })), "manual");
  assert.strictEqual(manual.get("A"), 4); assert.strictEqual(manual.get("D"), 1);
});

console.log("\n" + passed + " passed" + (process.exitCode ? ", some failed" : ""));
