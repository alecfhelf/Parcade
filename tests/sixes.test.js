// Run with: node tests/sixes.test.js
const assert = require("assert");
const X = require("../public/sixes.js");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + e.message); process.exitCode = 1; }
};

const ORDER = ["A", "B", "C", "D"];
// cards: { id: [strokes per hole] }. Net is gross unless a strokes map { id: [strokes off per hole] } is given.
const play = (cards, holes = 18, off = {}, final, opts) => X.sixesScore(ORDER, holes,
  (id, h) => (cards[id][h - 1] == null ? null : cards[id][h - 1] - ((off[id] || [])[h - 1] || 0)),
  (id, h) => (cards[id][h - 1] == null ? null : cards[id][h - 1]), final, opts);
const all = (n, v) => Array(n).fill(v);

test("Segments: 18 holes split 1-6, 7-12, 13-18", () => {
  assert.deepStrictEqual([1, 6, 7, 12, 13, 18].map(h => X.sixesSegment(h, 18)), [0, 0, 1, 1, 2, 2]);
  assert.deepStrictEqual([0, 1, 2].map(s => X.sixesSegHoles(s, 18)), [[1, 6], [7, 12], [13, 18]]);
});

test("Segments: 9 holes split 1-3, 4-6, 7-9", () => {
  assert.deepStrictEqual([1, 3, 4, 6, 7, 9].map(h => X.sixesSegment(h, 9)), [0, 0, 1, 1, 2, 2]);
  assert.deepStrictEqual([0, 1, 2].map(s => X.sixesSegHoles(s, 9)), [[1, 3], [4, 6], [7, 9]]);
});

test("Segments: starting on 10 follows play order", () => {
  assert.deepStrictEqual([10, 15, 16, 18, 1, 3, 4, 9].map(h => X.sixesSegment(h, 18, 10)), [0, 0, 1, 1, 1, 1, 2, 2]);
});

test("Teams rotate AB/CD, AC/BD, AD/BC", () => {
  assert.deepStrictEqual(X.sixesTeams(ORDER, 0), [["A", "B"], ["C", "D"]]);
  assert.deepStrictEqual(X.sixesTeams(ORDER, 1), [["A", "C"], ["B", "D"]]);
  assert.deepStrictEqual(X.sixesTeams(ORDER, 2), [["A", "D"], ["B", "C"]]);
});

test("Everyone partners everyone exactly once", () => {
  const seen = new Set();
  [0, 1, 2].forEach(s => X.sixesTeams(ORDER, s).forEach(t => seen.add(t.slice().sort().join(""))));
  assert.strictEqual(seen.size, 6);
});

test("Hole: best ball wins, equal best balls halve", () => {
  assert.strictEqual(X.sixesHoleWinner([[4, 6], [5, 5]]), 1);
  assert.strictEqual(X.sixesHoleWinner([[7, 6], [5, 9]]), 2);
  assert.strictEqual(X.sixesHoleWinner([[4, 8], [4, 5]]), 0);
});

test("Segment points: winners get 1 each, ties give everyone half", () => {
  // Segment 1: A wins every hole for A+B. Segment 2 (A+C vs B+D): all tied. Segment 3 (A+D vs B+C): B wins every hole.
  const c = { A: all(18, 5), B: all(18, 5), C: all(18, 6), D: all(18, 6) };
  for (let h = 0; h < 6; h++) c.A[h] = 4;
  for (let h = 12; h < 18; h++) c.B[h] = 3;
  const r = play(c);
  assert.deepStrictEqual(r.segs.map(s => s.winner), [1, 0, 2]);
  assert.deepStrictEqual(r.segs[0].won, { 1: 6, 2: 0 });
  assert.deepStrictEqual(r.points, { A: 1.5, B: 2.5, C: 1.5, D: 0.5 });
});

test("Segment: more holes won wins, halved holes don't count", () => {
  const c = { A: [4, 5, 5, 5, 5, 5], B: [6, 6, 6, 6, 6, 6], C: [5, 5, 5, 5, 5, 5], D: [6, 6, 6, 6, 6, 6] };
  ["A", "B", "C", "D"].forEach(id => (c[id] = c[id].concat(all(12, 5))));
  const r = play(c);
  assert.deepStrictEqual(r.segs[0].won, { 1: 1, 2: 0 });
  assert.strictEqual(r.segs[0].winner, 1);
  assert.strictEqual(r.points.A, 1 + 0.5 + 0.5);
});

test("Unfinished segment pays nothing until the round is final", () => {
  const c = { A: all(18, null), B: all(18, null), C: all(18, null), D: all(18, null) };
  for (let h = 0; h < 8; h++) { c.A[h] = 4; c.B[h] = 5; c.C[h] = 5; c.D[h] = 5; }
  const live = play(c);
  assert.deepStrictEqual(live.segs.map(s => s.winner), [1, null, null]);
  assert.deepStrictEqual(live.segs[1].won, { 1: 2, 2: 0 });
  assert.strictEqual(live.points.A, 1);
  const done = play(c, 18, {}, true);
  assert.deepStrictEqual(done.segs.map(s => s.winner), [1, 1, null]);
  assert.strictEqual(done.points.A, 2);
  assert.strictEqual(done.points.C, 1);
});

test("Clinched when the trailing team can't catch up", () => {
  const c = { A: all(18, null), B: all(18, null), C: all(18, null), D: all(18, null) };
  for (let h = 0; h < 4; h++) { c.A[h] = 4; c.B[h] = 5; c.C[h] = 5; c.D[h] = 5; }
  assert.strictEqual(play(c).segs[0].clinched, 1);
});

test("Tiebreak: holes won, then fewest strokes", () => {
  const c = { A: all(18, 5), B: all(18, 5), C: all(18, 5), D: all(18, 5) };
  // Segment 1 to A+B (A wins holes 1-2), segment 2 to A+C (C wins hole 7), segment 3 to B+C (B wins holes 13-15)
  c.A[0] = 4; c.A[1] = 4; c.C[6] = 4; c.B[12] = 4; c.B[13] = 4; c.B[14] = 4;
  const r = play(c);
  assert.deepStrictEqual(r.points, { A: 2, B: 2, C: 2, D: 0 });
  // All three on 2 points. Holes won: A 2+1, B 2+3, C 1+3.
  assert.deepStrictEqual(r.holesWon, { A: 3, B: 5, C: 4, D: 0 });
  assert.deepStrictEqual(r.standings.map(s => s.id), ["B", "C", "A", "D"]);
});

test("Tiebreak: strokes when points and holes won match, full ties share a place", () => {
  const c = { A: all(18, 5), B: all(18, 5), C: all(18, 5), D: all(18, 5) };
  const r = play(c);
  assert.deepStrictEqual(r.points, { A: 1.5, B: 1.5, C: 1.5, D: 1.5 });
  assert.deepStrictEqual(r.standings.map(s => s.place), [0, 0, 0, 0]);
  c.D[0] = 6; c.C[0] = 6;   // A+B win hole 1, so segment 1. C and D end level on points and holes won
  const r2 = play(c);
  assert.deepStrictEqual(r2.points, { A: 2, B: 2, C: 1, D: 1 });
  c.D[0] = 7;               // ...until D takes one more stroke
  const r3 = play(c);
  assert.deepStrictEqual(r3.standings.slice(2).map(s => s.id), ["C", "D"]);
});

test("Net vs gross: a handicap stroke flips the hole", () => {
  const c = { A: [4].concat(all(17, 5)), B: all(18, 5), C: [5].concat(all(17, 5)), D: all(18, 5) };
  const gross = play(c);
  assert.strictEqual(gross.holes[1].winner, 1);
  // C gets 2 strokes on hole 1: net 3 beats A's 4
  const net = play(c, 18, { C: [2] });
  assert.strictEqual(net.holes[1].winner, 2);
  assert.deepStrictEqual(net.holes[1].best, { 1: 4, 2: 5 });
  assert.deepStrictEqual(net.holes[1].bestNet, { 1: 4, 2: 3 });
  // Strokes tiebreak still uses gross
  assert.strictEqual(net.strokes.C, 90);
});

test("9-hole round: 3-hole segments", () => {
  const c = { A: [4, 4, 5, 5, 5, 5, 5, 5, 5], B: all(9, 5), C: all(9, 5), D: [5, 5, 5, 5, 5, 5, 4, 5, 5] };
  const r = play(c, 9);
  assert.deepStrictEqual(r.segs.map(s => s.range), [[1, 3], [4, 6], [7, 9]]);
  assert.deepStrictEqual(r.segs.map(s => s.winner), [1, 0, 1]);
  assert.deepStrictEqual(r.points, { A: 2.5, B: 1.5, C: 0.5, D: 1.5 });
});

test("Half points read as ½", () => {
  assert.deepStrictEqual([0, 0.5, 1, 2.5, 3].map(X.sixesPts), ["0", "½", "1", "2½", "3"]);
});

// ---- Nassau bets ----
// Every hole is a par 4, so 5s all round are bogeys that halve everything
const NASSAU = { nassau: true, presses: false, birdie: false, secondBall: false, par: () => 4 };
const nas = (cards, extra = {}, off = {}, final, holes = 18) => play(cards, holes, off, final, { ...NASSAU, ...extra });
const fives = () => ({ A: all(18, 5), B: all(18, 5), C: all(18, 5), D: all(18, 5) });
const results = s => s.bets.map(m => [m.key, m.winner, m.result]);

test("Nassau: each segment is Front (3), Back (3) and Overall (6)", () => {
  const r = nas(fives());
  assert.strictEqual(r.nassau, true);
  assert.deepStrictEqual(r.segs.map(s => s.bets.map(m => m.range)),
    [[[1, 3], [4, 6], [1, 6]], [[7, 9], [10, 12], [7, 12]], [[13, 15], [16, 18], [13, 18]]]);
});

test("Nassau: front, back and overall each pay 1 point to the winners", () => {
  const c = fives();
  c.A[0] = 4; c.A[3] = 4;   // A+B win holes 1 and 4
  c.D[8] = 4;               // set 2 (A+C vs B+D): B+D win hole 9, so the Front and Overall
  const r = nas(c);
  assert.deepStrictEqual(results(r.segs[0]), [["front", 1, "1 UP"], ["back", 1, "1 UP"], ["overall", 1, "2 & 1"]]);
  assert.deepStrictEqual(results(r.segs[1]), [["front", 2, "1 UP"], ["back", 0, "Halved"], ["overall", 2, "1 UP"]]);
  // A: 3 (set 1) + ½ (set 2) + 1½ (set 3 halved). D: 0 + 2½ + 1½
  assert.deepStrictEqual(r.points, { A: 5, B: 7, C: 2, D: 4 });
  // 9 bets, 2 people each: 18 points in all
  assert.strictEqual(Object.values(r.points).reduce((a, b) => a + b, 0), 18);
});

test("Nassau: halved bets are ½ each, all square is 4½ points apiece", () => {
  const r = nas(fives());
  r.segs.forEach(s => assert.deepStrictEqual(s.bets.map(m => m.winner), [0, 0, 0]));
  assert.deepStrictEqual(r.points, { A: 4.5, B: 4.5, C: 4.5, D: 4.5 });
});

test("Nassau: a 3 & 0 Front is clinched after 2 holes", () => {
  const c = fives();
  c.C[0] = 4; c.C[1] = 4;
  const front = nas(c).segs[0].bets[0];
  assert.deepStrictEqual([front.winner, front.result], [2, "2 & 1"]);
});

test("Nassau: bets unfinished mid-round pay nothing until the round is final", () => {
  const c = fives();
  for (const id of ORDER) for (let h = 4; h < 18; h++) c[id][h] = null;
  c.A[0] = 4;
  const live = nas(c);
  assert.deepStrictEqual(live.segs[0].bets.map(m => m.winner), [1, null, null]);
  assert.strictEqual(live.points.A, 1);
  const done = nas(c, {}, {}, true);
  // Back played 1 halved hole, Overall A+B 1 UP after 4. Sets 2 and 3 never started.
  assert.deepStrictEqual(results(done.segs[0]), [["front", 1, "1 UP"], ["back", 0, "Halved"], ["overall", 1, "1 UP"]]);
  assert.deepStrictEqual(done.segs[1].bets.map(m => m.winner), [null, null, null]);
  assert.deepStrictEqual(done.points, { A: 2.5, B: 2.5, C: 0.5, D: 0.5 });
});

test("Presses: 2 down after 2 holes of a half presses the 3rd, and the Overall presses to the end of the set", () => {
  const c = fives();
  c.C[0] = 4; c.C[1] = 4;   // C+D win 1 and 2
  c.A[2] = 4;               // A+B win 3
  const r = nas(c, { presses: true });
  const s = r.segs[0];
  assert.deepStrictEqual(r.holes[2].presses, [3, 4]);
  assert.deepStrictEqual(s.bets.slice(3).map(m => [m.parent, m.by, m.range]), [[0, 1, [3, 3]], [2, 1, [3, 6]]]);
  // Front and Overall stay with C+D (2 holes won to 1). A+B win both presses off hole 3.
  assert.deepStrictEqual(results(s), [["front", 2, "2 & 1"], ["back", 0, "Halved"], ["overall", 2, "1 UP"], ["press", 1, "1 UP"], ["press", 1, "1 UP"]]);
  // Set 1: A+B 2 (presses), C+D 2 (front, overall), back ½ each
  assert.strictEqual(r.points.A - r.points.C, 0);
});

test("Presses: none when 2 down comes on the last hole of a half", () => {
  const c = fives();
  c.C[1] = 4; c.C[2] = 4;   // C+D win 2 and 3: 2 down in the Front with the half over
  const s = nas(c, { presses: true }).segs[0];
  assert.ok(!s.bets.some(m => m.key === "press" && m.parent === 0));
  // ...but the Overall has 3 holes left, so it gets pressed for 4-6
  assert.deepStrictEqual(s.bets.slice(3).map(m => [m.parent, m.range]), [[2, [4, 6]]]);
});

test("Presses: off means no presses, and presses don't change the bets they came from", () => {
  const c = fives();
  c.C[0] = 4; c.C[1] = 4; c.A[2] = 4;
  const off = nas(c), on = nas(c, { presses: true });
  assert.strictEqual(off.segs[0].bets.length, 3);
  assert.deepStrictEqual(results(off.segs[0]), results(on.segs[0]).slice(0, 3));
});

test("Birdie bonus: a gross birdie is +1 for each teammate, a net birdie isn't", () => {
  const c = fives();
  c.A[0] = 3;               // A birdies hole 1 (and A+B win it)
  c.D[1] = 4;               // D pars hole 2 with a stroke: net 3, no birdie
  const on = nas(c, { birdie: true }, { D: [0, 1] });
  assert.deepStrictEqual(on.segs[0].birdies, [{ hole: 1, team: 1 }]);
  assert.deepStrictEqual(on.holes[1].birdies, [1]);
  const off = nas(c, {}, { D: [0, 1] });
  assert.strictEqual(on.points.A - off.points.A, 1);
  assert.strictEqual(on.points.B - off.points.B, 1);
  assert.strictEqual(on.points.D, off.points.D);
});

test("Birdie bonus: both teams can birdie the same hole, eagles count", () => {
  const c = fives();
  c.A[0] = 2; c.C[0] = 3;
  const r = nas(c, { birdie: true });
  assert.deepStrictEqual(r.holes[1].birdies, [1, 2]);
});

test("Second-ball tiebreak: tied best balls go to the better other ball", () => {
  assert.strictEqual(X.sixesHoleWinner([[4, 6], [4, 5]], true), 2);
  assert.strictEqual(X.sixesHoleWinner([[4, 6], [4, 5]], false), 0);
  assert.strictEqual(X.sixesHoleWinner([[4, 5], [4, 5]], true), 0);
  assert.strictEqual(X.sixesHoleWinner([[3, 9], [4, 4]], true), 1);
  const c = fives();
  c.A[0] = 4; c.C[0] = 4; c.D[0] = 4;   // best balls tie at 4, C+D's other ball (4) beats B's 5
  const on = nas(c, { secondBall: true });
  assert.strictEqual(on.holes[1].winner, 2);
  assert.strictEqual(on.holes[1].secondBall, true);
  assert.strictEqual(nas(c).holes[1].winner, 0);
});

test("Nassau: net vs gross flips a bet", () => {
  const c = fives();
  c.A[0] = 4;                                  // gross: A+B win hole 1, so the Front
  assert.strictEqual(nas(c).segs[0].bets[0].winner, 1);
  const net = nas(c, {}, { C: [2] });          // C gets 2 strokes on hole 1: net 3
  assert.strictEqual(net.segs[0].bets[0].winner, 2);
  // The birdie bonus stays gross: C's net 3 isn't a birdie
  assert.deepStrictEqual(nas(c, { birdie: true }, { C: [2] }).segs[0].birdies, []);
});

test("Nassau on a 9-hole card: Overall only per set, same as plain Sixes", () => {
  const c = { A: [4, 4, 5, 5, 5, 5, 5, 5, 5], B: all(9, 5), C: all(9, 5), D: [5, 5, 5, 5, 5, 5, 4, 5, 5] };
  const plain = play(c, 9), on = nas(c, { presses: true, birdie: true, secondBall: true }, {}, false, 9);
  assert.strictEqual(on.nassau, false);
  assert.strictEqual(on.segs[0].bets, undefined);
  assert.deepStrictEqual(on.points, plain.points);
});

test("Nassau off scores exactly like plain Sixes", () => {
  const c = fives();
  c.A[0] = 4; c.C[8] = 3; c.D[15] = 4;
  const plain = play(c);
  const off = play(c, 18, {}, false, { ...NASSAU, nassau: false, presses: true, birdie: true, secondBall: true });
  assert.deepStrictEqual(off.points, plain.points);
  assert.deepStrictEqual(off.segs.map(s => s.winner), plain.segs.map(s => s.winner));
  assert.strictEqual(off.nassau, false);
});

test("Money: each bet is worth the rate from the other team", () => {
  // One bet to A+B: +1 each for them, -1 each for C and D
  assert.deepStrictEqual(X.sixesMoney({ A: 1, B: 1, C: 0, D: 0 }, 2), { A: 2, B: 2, C: -2, D: -2 });
  // A halved bet moves nothing
  assert.deepStrictEqual(X.sixesMoney({ A: 0.5, B: 0.5, C: 0.5, D: 0.5 }, 2), { A: 0, B: 0, C: 0, D: 0 });
  const c = fives();
  c.A[0] = 4; c.A[3] = 4;
  const m = X.sixesMoney(nas(c).points, 1);
  assert.strictEqual(Object.values(m).reduce((a, b) => a + b, 0), 0);
  // A+B swept set 1 (3 bets). The other two sets halved.
  assert.deepStrictEqual(m, { A: 3, B: 3, C: -3, D: -3 });
});

console.log("\n" + passed + " passed");
