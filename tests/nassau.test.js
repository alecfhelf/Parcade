// Run with: node tests/nassau.test.js
const assert = require("assert");
const X = require("../public/nassau.js");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + e.message); process.exitCode = 1; }
};

const SINGLES = [["A"], ["B"]], TEAMS = [["A", "B"], ["C", "D"]];
// cards: { id: [strokes per hole number] }. Net is gross unless off { id: [strokes off per hole] } is given.
const play = (sides, cards, opts = {}, off = {}) => X.nassauScore(sides,
  (id, h) => (cards[id][h - 1] == null ? null : cards[id][h - 1] - ((off[id] || [])[h - 1] || 0)),
  (id, h) => (cards[id][h - 1] == null ? null : cards[id][h - 1]), opts);
const all = (n, v) => Array(n).fill(v);
// A 4 and B 5 on the given hole numbers, both 4 everywhere else
const aWins = (holes, bHoles = []) => {
  const c = { A: all(18, 4), B: all(18, 4) };
  holes.forEach(h => (c.B[h - 1] = 5));
  bHoles.forEach(h => (c.A[h - 1] = 5));
  return c;
};
const results = r => r.matches.map(m => [m.key, m.winner, m.result]);

test("Hole: best ball wins, equal best balls halve", () => {
  assert.strictEqual(X.nassauHoleWinner([[4], [5]]), 1);
  assert.strictEqual(X.nassauHoleWinner([[7, 6], [5, 9]]), 2);
  assert.strictEqual(X.nassauHoleWinner([[4, 8], [4, 5]]), 0);
});

test("Singles, gross: front closed out 3 & 2, back halved, overall 3 & 2", () => {
  const r = play(SINGLES, aWins([1, 2, 3]));
  assert.deepStrictEqual(results(r), [["front", 1, "3 & 2"], ["back", 0, "Halved"], ["overall", 1, "3 & 2"]]);
  assert.deepStrictEqual(r.points, { A: 2.5, B: 0.5 });
  assert.deepStrictEqual(r.holesWon, { A: 3, B: 0 });
});

test("Singles: a 1 UP win on the last hole", () => {
  const r = play(SINGLES, aWins([18]));
  assert.deepStrictEqual(results(r), [["front", 0, "Halved"], ["back", 1, "1 UP"], ["overall", 1, "1 UP"]]);
  assert.deepStrictEqual(r.points, { A: 2.5, B: 0.5 });
});

test("Singles, net: handicap strokes halve every hole and every match", () => {
  const c = { A: all(18, 4), B: all(18, 5) };
  const gross = play(SINGLES, c);
  assert.deepStrictEqual(gross.points, { A: 3, B: 0 });
  const net = play(SINGLES, c, {}, { B: all(18, 1) });
  assert.deepStrictEqual(results(net), [["front", 0, "Halved"], ["back", 0, "Halved"], ["overall", 0, "Halved"]]);
  assert.deepStrictEqual(net.points, { A: 1.5, B: 1.5 });
});

test("Teams, gross: best ball counts and both teammates get the points", () => {
  const c = { A: all(18, 5), B: all(18, 6), C: all(18, 5), D: all(18, 5) };
  for (let h = 0; h < 9; h++) c.A[h] = 4;   // A carries the front
  c.D[17] = 4;                               // D wins 18 for C+D
  const r = play(TEAMS, c);
  assert.deepStrictEqual(results(r), [["front", 1, "5 & 4"], ["back", 2, "1 UP"], ["overall", 1, "9 & 8"]]);
  assert.deepStrictEqual(r.points, { A: 2, B: 2, C: 1, D: 1 });
  assert.deepStrictEqual(r.holesWon, { A: 9, B: 9, C: 1, D: 1 });
});

test("Teams, net: a stroke on the worse player's card flips the hole", () => {
  const c = { A: all(18, 4), B: all(18, 6), C: all(18, 5), D: all(18, 6) };
  const gross = play(TEAMS, c);
  assert.deepStrictEqual(gross.points, { A: 3, B: 3, C: 0, D: 0 });
  // C gets 2 strokes on every hole: net 3 beats A's 4
  const net = play(TEAMS, c, {}, { C: all(18, 2) });
  assert.deepStrictEqual(net.points, { A: 0, B: 0, C: 3, D: 3 });
  assert.strictEqual(net.holes[1].best[2], 5);
  assert.strictEqual(net.holes[1].bestNet[2], 3);
});

test("Halved holes and matches: all square everywhere gives ½ each per bet", () => {
  const r = play(TEAMS, { A: all(18, 4), B: all(18, 5), C: all(18, 5), D: all(18, 4) });
  assert.deepStrictEqual(r.matches.map(m => m.winner), [0, 0, 0]);
  assert.deepStrictEqual(r.points, { A: 1.5, B: 1.5, C: 1.5, D: 1.5 });
  assert.ok(Object.values(r.holes).every(h => h.winner === 0));
});

test("Presses off: going 2 down starts nothing", () => {
  const r = play(SINGLES, aWins([1, 2]));
  assert.strictEqual(r.matches.length, 3);
});

test("Presses: 2 down starts a press on the next hole, and a press can be pressed", () => {
  const r = play(SINGLES, aWins([1, 2, 3, 4]), { presses: true });
  const [front, back, overall, p1, p2] = r.matches;
  assert.strictEqual(r.matches.length, 5);
  assert.deepStrictEqual([p1.range, p1.by, p1.parent, p1.nine], [[3, 9], 2, 0, 0]);
  assert.deepStrictEqual([p2.range, p2.by, p2.parent, p2.nine], [[5, 9], 2, 3, 0]);
  assert.deepStrictEqual(r.holes[2].presses, [3]);
  assert.deepStrictEqual(r.holes[4].presses, [4]);
  assert.deepStrictEqual([front.result, p1.result, p2.result, back.result, overall.result], ["4 & 3", "2 & 1", "Halved", "Halved", "4 & 3"]);
  // Front 1 + press 1 + press on the press ½ + back ½ + overall 1
  assert.deepStrictEqual(r.points, { A: 4, B: 1 });
});

test("Presses never touch the Front, Back or Overall, and the Overall is never pressed", () => {
  const c = aWins([1, 2, 3, 4, 10, 11]);
  const off = play(SINGLES, c), on = play(SINGLES, c, { presses: true });
  [0, 1, 2].forEach(i => assert.deepStrictEqual(
    [on.matches[i].winner, on.matches[i].result, on.matches[i].up], [off.matches[i].winner, off.matches[i].result, off.matches[i].up]));
  assert.ok(on.matches.filter(m => m.key === "press").every(m => m.nine !== null));
  assert.ok(on.matches.every(m => m.key !== "press" || on.matches[m.parent].key !== "overall"));
  assert.deepStrictEqual(on.matches.filter(m => m.key === "press").map(m => m.range), [[3, 9], [5, 9], [12, 18]]);
});

test("Presses: 2 down on the last hole of a nine starts nothing, on the 8th it's a one-hole press", () => {
  assert.strictEqual(play(SINGLES, aWins([8, 9]), { presses: true }).matches.length, 3);
  assert.strictEqual(play(SINGLES, aWins([17, 18]), { presses: true }).matches.length, 3);
  const r = play(SINGLES, aWins([7, 8], [9]), { presses: true });
  assert.deepStrictEqual(r.matches.slice(3).map(m => [m.range, m.winner, m.result]), [[[9, 9], 2, "1 UP"]]);
  // The front was already won 2 & 1 when the press started, so losing 9 only counts in the press
  assert.deepStrictEqual(results(r).slice(0, 1), [["front", 1, "2 & 1"]]);
});

test("Presses work for teams and the trailing side can press back after a comeback", () => {
  const c = { A: all(18, 5), B: all(18, 5), C: all(18, 5), D: all(18, 5) };
  [1, 2].forEach(h => (c.A[h - 1] = 4));         // A+B go 2 up
  [3, 4, 5, 6].forEach(h => (c.C[h - 1] = 4));   // C+D win four in a row
  const r = play(TEAMS, c, { presses: true });
  const presses = r.matches.slice(3).map(m => [m.range, m.by, m.parent]);
  // After 2: C+D are 2 down in the front and press (3-9). After 4, A+B are 2 down in that press and press it (5-9).
  // After 6, A+B are 2 down in the front (they haven't pressed it yet) and in their press, so both get pressed (7-9).
  assert.deepStrictEqual(presses, [[[3, 9], 2, 0], [[5, 9], 1, 3], [[7, 9], 1, 0], [[7, 9], 1, 4]]);
  assert.deepStrictEqual(r.matches.map(m => m.winner), [2, 0, 2, 2, 2, 0, 0]);
  assert.deepStrictEqual(r.matches.map(m => m.result), ["2 & 1", "Halved", "2 & 1", "4 & 3", "2 & 1", "Halved", "Halved"]);
});

test("Swapped nines: starting on 10, the Front is the first 9 played", () => {
  const c = aWins([10, 11, 12]);
  const r = play(SINGLES, c, { start: 10 });
  assert.deepStrictEqual(results(r), [["front", 1, "3 & 2"], ["back", 0, "Halved"], ["overall", 1, "3 & 2"]]);
  assert.strictEqual(r.holes[10].pos, 1);
  assert.strictEqual(r.holes[1].pos, 10);
  assert.deepStrictEqual([1, 9, 10, 18].map(p => X.nassauHoleAt(p, 10)), [10, 18, 1, 9]);
  const p = play(SINGLES, aWins([10, 11]), { start: 10, presses: true });
  assert.deepStrictEqual(p.matches[3].range, [3, 9]);
});

test("Live: unfinished bets stay open, and final settles what was played", () => {
  const c = aWins([1, 2]);
  for (let h = 6; h <= 18; h++) { c.A[h - 1] = null; c.B[h - 1] = null; }
  const live = play(SINGLES, c);
  assert.deepStrictEqual(live.matches.map(m => m.winner), [null, null, null]);
  assert.deepStrictEqual(live.points, { A: 0, B: 0 });
  const done = play(SINGLES, c, { final: true });
  assert.deepStrictEqual(results(done), [["front", 1, "2 UP"], ["back", null, null], ["overall", 1, "2 UP"]]);
  assert.deepStrictEqual(done.points, { A: 2, B: 0 });
});

test("Status text, golf style", () => {
  const r = play(SINGLES, aWins([1, 2, 3]));
  const names = ["Alec", "Sam"];
  assert.deepStrictEqual(r.matches.map(m => X.nassauStatusText(m, names)), ["Alec wins 3 & 2", "Halved", "Alec wins 3 & 2"]);
  const c = aWins([1], [2, 3]);
  for (let h = 4; h <= 18; h++) { c.A[h - 1] = null; c.B[h - 1] = null; }
  const live = play(SINGLES, c);
  assert.deepStrictEqual(live.matches.map(m => X.nassauStatusText(m, names)), ["Sam 1 UP", "All square", "Sam 1 UP"]);
  const dormie = aWins([1, 2]);
  for (let h = 8; h <= 18; h++) dormie.A[h - 1] = dormie.B[h - 1] = null;
  assert.strictEqual(X.nassauStatusText(play(SINGLES, dormie).matches[0], names), "Alec 2 UP, dormie");
  assert.strictEqual(X.nassauLabel({ key: "press", range: [5, 9] }), "Press, holes 5–9");
  assert.strictEqual(X.nassauLabel({ key: "front" }), "Front");
  assert.strictEqual(X.nassauStatusText(r.matches[0], ["Alec & Jo", "Sam & Kim"]), "Alec & Jo win 3 & 2");
});

test("Tiebreaks: points, then holes won, then fewest strokes", () => {
  const sc = { points: { A: 2, B: 2, C: 2, D: 1 }, holesWon: { A: 5, B: 6, C: 5, D: 9 }, strokes: { A: 80, B: 90, C: 78, D: 70 } };
  assert.deepStrictEqual(X.nassauRank(["A", "B", "C", "D"], sc).map(r => [r.id, r.place]), [["B", 0], ["C", 1], ["A", 2], ["D", 3]]);
  sc.strokes.A = 78;
  assert.deepStrictEqual(X.nassauRank(["A", "B", "C", "D"], sc).map(r => r.place), [0, 1, 1, 3]);
});

test("Tiebreaks in a round: level on points and holes, fewer strokes wins", () => {
  // A wins 1 and 2 (Sam presses 3-9), Sam wins 9. Sam wins 10 and 11 (Alec presses 12-18), Alec wins 18.
  const c = aWins([1, 2, 18], [9, 10, 11]);
  c.B[0] = 7;   // Sam loses hole 1 by three, which costs nothing extra on points but shows up in strokes
  const r = play(SINGLES, c, { presses: true });
  assert.deepStrictEqual(r.matches.map(m => m.winner), [1, 2, 0, 2, 1]);
  assert.deepStrictEqual(r.points, { A: 2.5, B: 2.5 });
  assert.deepStrictEqual(r.holesWon, { A: 3, B: 3 });
  assert.deepStrictEqual(r.standings.map(s => [s.id, s.place]), [["A", 0], ["B", 1]]);
});

test("Money: per bet, head to head in singles and against the other side in teams", () => {
  assert.deepStrictEqual(X.nassauMoney(SINGLES, { A: 2.5, B: 0.5 }, 5), { A: 10, B: -10 });
  assert.deepStrictEqual(X.nassauMoney(TEAMS, { A: 3, B: 3, C: 0, D: 0 }, 1), { A: 3, B: 3, C: -3, D: -3 });
  assert.deepStrictEqual(X.nassauMoney(TEAMS, { A: 1.5, B: 1.5, C: 1.5, D: 1.5 }, 2), { A: 0, B: 0, C: 0, D: 0 });
});

console.log("\n" + passed + " passed");
