// Run with: node tests/seasonscore.test.js
const assert = require("assert");
const S = require("../public/seasonscore.js");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + e.message); process.exitCode = 1; }
};
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, (msg || "") + " expected " + b + ", got " + a);

const PEBBLE = { pars: [4, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5], rating: 71.7, slope: 135 };
// A card that adds `over` strokes, one per hole starting at hole 1 (never more than +1 on a hole)
const card = (pars, over) => pars.map((p, i) => p + (i < over ? 1 : 0) + (over > 18 && i < over - 18 ? 1 : 0));

test("Pebble: Jake (h 5) shoots 80", () => {
  const s = card(PEBBLE.pars, 8);
  assert.strictEqual(S.scoreRound({ h: 5, strokes: s, pars: PEBBLE.pars, rating: 71.7, slope: 135 }).gross, 80);
  const r = S.scoreRound({ h: 5, strokes: s, pars: PEBBLE.pars, rating: 71.7, slope: 135 });
  assert.strictEqual(r.ch, 6);
  assert.strictEqual(r.adjusted, 80);
  assert.strictEqual(r.roundRating, 6.9);
  assert.strictEqual(r.points, 6.1);
});

test("Pebble: Mike (h 20) shoots 92", () => {
  const s = card(PEBBLE.pars, 20);
  const r = S.scoreRound({ h: 20, strokes: s, pars: PEBBLE.pars, rating: 71.7, slope: 135 });
  assert.strictEqual(r.gross, 92);
  assert.strictEqual(r.adjusted, 92);
  assert.strictEqual(r.roundRating, 17.0);
  assert.strictEqual(r.points, 16.0);
});

test("An 11 on a par 4 gets capped at net double bogey", () => {
  const pars = Array(18).fill(4);
  const s = pars.slice();
  s[0] = 11;
  // h 0 on a par-72, 72/113 course: no strokes, cap is 6
  const r = S.scoreRound({ h: 0, strokes: s, pars, rating: 72, slope: 113 });
  assert.strictEqual(r.gross, 79);
  assert.strictEqual(r.adjusted, 74);
  // h 18: one stroke per hole, cap is 7
  const r2 = S.scoreRound({ h: 18, strokes: s, pars, rating: 72, slope: 113 });
  assert.strictEqual(r2.ch, 18);
  assert.strictEqual(r2.adjusted, 75);
});

test("Strokes follow hole handicaps, and spread evenly without them", () => {
  const idx = [7, 1, 13, 3, 17, 5, 15, 9, 11, 8, 2, 14, 4, 18, 6, 16, 10, 12];
  const st = S.strokesByHole(2, idx);
  assert.deepStrictEqual(st.map((x, i) => (x ? i + 1 : 0)).filter(Boolean), [2, 11]);
  const wrap = S.strokesByHole(20, idx);
  assert.strictEqual(wrap[1], 2);
  assert.strictEqual(wrap[10], 2);
  assert.strictEqual(wrap[0], 1);
  const even = S.strokesByHole(9, null);
  assert.strictEqual(even.reduce((a, b) => a + b, 0), 9);
  assert.deepStrictEqual(even, [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
});

test("Season handicap drifts in order across 3 rounds", () => {
  const pars = Array(18).fill(4);
  const diff = { rating: 72, slope: 113 };
  const entries = [
    { user_id: "a", round_id: "r3", date: "2026-10-03", strokes: card(pars, 2), pars, diff },
    { user_id: "a", round_id: "r1", date: "2026-10-01", strokes: card(pars, 10), pars, diff },
    { user_id: "a", round_id: "r2", date: "2026-10-02", strokes: card(pars, 18), pars, diff },
  ];
  const [row] = S.scoreSeason({ format: "rounds", count: 5, members: [{ user_id: "a", handicap: 10 }], entries });
  assert.deepStrictEqual(row.rounds.map(r => r.round_id), ["r1", "r2", "r3"]);
  assert.deepStrictEqual(row.rounds.map(r => r.hBefore), [10, 10, 11.6]);
  // r1: rating 10 -> h 10. r2: rating 18 -> 10 + 1.6 = 11.6. r3: rating 2 -> 11.6 - 1.92 = 9.7
  assert.strictEqual(row.h, 9.7);
  // r2 would be 10 + 2 * (10 - 18) = -6, which clamps to 0
  assert.deepStrictEqual(row.rounds.map(r => r.points), [10, 0, 29.2]);
});

test("Head-to-head: wins, losses and ties by round rating, points untouched", () => {
  const pars = Array(18).fill(4);
  const diff = { rating: 72, slope: 113 };
  const m = ["a", "b", "c", "d"].map(u => ({ user_id: u, handicap: 10 }));
  const e = (u, round, over) => ({ user_id: u, round_id: round, date: "2026-10-01", strokes: card(pars, over), pars, diff });
  const run = entries => S.scoreSeason({ format: "rounds", count: 5, members: m, entries });
  const rec = rows => Object.fromEntries(rows.map(r => [r.member.user_id, [r.h2h.w, r.h2h.l, r.h2h.t]]));

  // Two players: a beats b
  let rows = run([e("a", "r1", 8), e("b", "r1", 12)]);
  assert.deepStrictEqual(rec(rows), { a: [1, 0, 0], b: [0, 1, 0], c: [0, 0, 0], d: [0, 0, 0] });
  const ar1 = rows.find(r => r.member.user_id === "a").rounds[0];
  assert.deepStrictEqual([ar1.beat, ar1.lostTo, ar1.tied], [["b"], [], []]);

  // Three players, a and b tie: each ties the other and beats c
  rows = run([e("a", "r1", 8), e("b", "r1", 8), e("c", "r1", 15)]);
  assert.deepStrictEqual(rec(rows), { a: [1, 0, 1], b: [1, 0, 1], c: [0, 2, 0], d: [0, 0, 0] });
  const br1 = rows.find(r => r.member.user_id === "b").rounds[0];
  assert.deepStrictEqual([br1.beat, br1.lostTo, br1.tied], [["c"], [], ["a"]]);

  // Adds up across rounds; solo rounds don't count
  rows = run([e("a", "r1", 5), e("b", "r1", 8), e("c", "r1", 8), e("d", "r1", 20), e("b", "r2", 2), e("a", "r2", 9), e("d", "r3", 0)]);
  assert.deepStrictEqual(rec(rows), { a: [3, 1, 0], b: [2, 1, 1], c: [1, 1, 1], d: [0, 3, 0] });

  // Points are the same with or without company
  const solo = run([e("a", "r1", 8)]).find(r => r.member.user_id === "a");
  const group = run([e("a", "r1", 8), e("b", "r1", 12)]).find(r => r.member.user_id === "a");
  assert.strictEqual(group.rounds[0].points, solo.rounds[0].points);
  assert.strictEqual(group.points, solo.points);
  assert.strictEqual(group.rounds[0].bonus, undefined);
});

test("Head-to-head doesn't break standings ties", () => {
  const pars = Array(18).fill(4);
  const diff = { rating: 72, slope: 113 };
  // a (10) shoots 82, b (12) shoots 84: a has the better round rating, but both play to handicap
  const rows = S.scoreSeason({ format: "rounds", count: 5,
    members: [{ user_id: "a", handicap: 10 }, { user_id: "b", handicap: 12 }],
    entries: [
      { user_id: "a", round_id: "r1", date: "2026-10-01", strokes: card(pars, 10), pars, diff },
      { user_id: "b", round_id: "r1", date: "2026-10-01", strokes: card(pars, 12), pars, diff },
    ] });
  // Both play exactly to handicap: 10 points each, tied place even though a won head-to-head
  assert.deepStrictEqual(rows.map(r => r.points), [10, 10]);
  assert.deepStrictEqual(rows.map(r => r.place), [0, 0]);
  assert.strictEqual(rows.find(r => r.member.user_id === "a").h2h.w, 1);
});

test("Dates format counts the best N, ties break on average then best round", () => {
  const pars = Array(18).fill(4);
  const diff = { rating: 72, slope: 113 };
  const e = (u, round, date, over) => ({ user_id: u, round_id: round, date, strokes: card(pars, over), pars, diff });
  const rows = S.scoreSeason({ format: "dates", count: 2, members: [{ user_id: "a", handicap: 10 }, { user_id: "b", handicap: 10 }],
    entries: [e("a", "1", "2026-10-01", 10), e("a", "2", "2026-10-02", 30), e("a", "3", "2026-10-03", 10)] });
  const a = rows[0];
  assert.strictEqual(a.member.user_id, "a");
  assert.strictEqual(a.rounds.length, 3);
  assert.strictEqual(a.counted.size, 2);
  assert.ok(!a.counted.has(a.rounds[1]));
  assert.strictEqual(rows[1].points, 0);
  assert.strictEqual(rows[1].place, 1);
});

test("Difficulty: official", () => {
  const d = S.resolveDifficulty({ ...PEBBLE, rating_source: "official" }, null);
  assert.deepStrictEqual([d.rating, d.slope, d.source], [71.7, 135, "official"]);
  assert.strictEqual(S.difficultyBadge(d), "Official");
});

test("Difficulty: estimated from another tee (stored rating)", () => {
  const d = S.resolveDifficulty({ ...PEBBLE, rating: 70.1, slope: 128, rating_source: "tee_estimate" }, null);
  assert.deepStrictEqual([d.rating, d.slope, d.source], [70.1, 128, "estimated"]);
  assert.strictEqual(S.difficultyBadge(d), "Estimated");
});

test("Difficulty: estimated from yardage, men's and women's", () => {
  const men = S.resolveDifficulty({ pars: PEBBLE.pars, yardage: 6800, tee_gender: "M" }, null);
  // scratch 71.809, bogey 93.2, slope 5.381 * 21.391 = 115.1
  assert.deepStrictEqual([men.rating, men.slope, men.source], [71.8, 115, "estimated"]);
  const women = S.resolveDifficulty({ pars: PEBBLE.pars, yardage: 5400, tee_gender: "F" }, null);
  // scratch 70.1, bogey 96.3, slope 4.24 * 26.2 = 111.1
  assert.deepStrictEqual([women.rating, women.slope, women.source], [70.1, 111, "estimated"]);
});

test("Difficulty: default with and without a course", () => {
  const none = S.resolveDifficulty(null, null);
  assert.deepStrictEqual([none.rating, none.slope, none.source], [72, 113, "default"]);
  const par70 = S.resolveDifficulty({ pars: [4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 4, 3, 5, 4] }, null);
  assert.deepStrictEqual([par70.rating, par70.slope, par70.source], [70, 113, "default"]);
  assert.strictEqual(S.difficultyBadge(par70), "Default");
});

test("Difficulty: clamps rating to par -6 / +8 and slope to 55 / 155", () => {
  const hi = S.resolveDifficulty({ pars: PEBBLE.pars, rating: 90, slope: 200 }, null);
  assert.deepStrictEqual([hi.rating, hi.slope], [80, 155]);
  const lo = S.resolveDifficulty({ pars: PEBBLE.pars, rating: 50, slope: 20 }, null);
  assert.deepStrictEqual([lo.rating, lo.slope], [66, 55]);
  const tiny = S.resolveDifficulty({ pars: PEBBLE.pars, yardage: 1500, tee_gender: "M" }, null);
  // 1500 yards: scratch 47.7 clamps up to 66, slope 5.381 * 12.36 = 66
  assert.strictEqual(tiny.rating, 66);
  assert.strictEqual(tiny.slope, 66);
});

test("Difficulty: learned needs 5 samples from 3 players, drops outliers", () => {
  const course = { pars: Array(18).fill(4) };  // default: 72 / 113
  // Every sample plays 2 over its handicap, plus one wild outlier
  const samples = [0, 5, 10, 15, 20, 8].map(h => ({ gross: 72 + h + 2, hcp: h })).concat([{ gross: 130, hcp: 10 }]);
  const d = S.resolveDifficulty(course, { samples, players: 3 });
  assert.strictEqual(d.source, "learned");
  assert.strictEqual(d.detail, "Learned from 6 rounds.");
  near(d.rating, Math.round((72 + (6 / 16) * 2) * 10) / 10);
  assert.strictEqual(d.slope, 113);
  assert.strictEqual(S.difficultyBadge(d), "Learned from 6 rounds");

  assert.strictEqual(S.resolveDifficulty(course, { samples, players: 2 }).source, "default");
  assert.strictEqual(S.resolveDifficulty(course, { samples: samples.slice(0, 4), players: 4 }).source, "default");
  const off = S.resolveDifficulty({ ...PEBBLE }, { samples: samples.slice(0, 6), players: 3 });
  assert.strictEqual(off.source, "learned");
  assert.strictEqual(off.slope, 135);
});

test("Season status", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const dates = { format: "dates", starts_at: "2026-10-01T07:00:00Z", ends_at: "2027-01-01T07:59:59Z" };
  assert.strictEqual(S.seasonStatus(dates, [], null, now), "active");
  assert.strictEqual(S.seasonStatus(dates, [], null, new Date("2026-09-01")), "upcoming");
  assert.strictEqual(S.seasonStatus(dates, [], null, new Date("2027-02-01")), "final");
  const rounds = { format: "rounds", rounds_count: 2 };
  const members = [{ user_id: "a" }, { user_id: "b" }];
  assert.strictEqual(S.seasonStatus(rounds, members, new Map([["a", 2], ["b", 1]]), now), "active");
  assert.strictEqual(S.seasonStatus(rounds, members, new Map([["a", 2], ["b", 2]]), now), "final");
  assert.strictEqual(S.seasonStatus({ ...rounds, ended_at: "2026-10-10" }, members, new Map(), now), "final");
  assert.strictEqual(S.seasonStatus({ format: "legacy" }, members, new Map(), now), null);
});

console.log("\n" + passed + " passed" + (process.exitCode ? ", some failed" : ""));
