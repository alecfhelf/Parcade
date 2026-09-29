// ---------- Money ----------
function moneyFmt(n) {
  n = Math.round((n || 0) * 100) / 100;
  return (n < 0 ? "-$" : "$") + (Number.isInteger(Math.abs(n)) ? Math.abs(n) : Math.abs(n).toFixed(2));
}

function moneySummary(round) {
  if (round.stakes === "pot") {
    const p = round.payouts || [];
    const places = ["1st", "2nd", "3rd"].map((l, i) => (p[i] ? l + " " + moneyFmt(p[i]) : null)).filter(Boolean).join(", ");
    return "💵 " + moneyFmt(round.buy_in) + " buy-in. " + places;
  }
  if (round.stakes === "point") {
    const unit = round.mode === "stroke" ? "stroke" : round.mode === "skins" ? "skin" : round.mode === "wad" ? "Wad" : "point";
    return "💵 " + moneyFmt(round.per_point) + " per " + unit;
  }
  return "";
}

function moneySigned(n) {
  n = Math.round((n || 0) * 100) / 100;
  return (n > 0 ? "+" : "") + moneyFmt(n);
}

// entries: [{ pl, v }] where a higher v is better
function moneyNet(round, entries, players, bets, override) {
  const net = {};
  players.forEach(p => (net[p.id] = { round: 0, bets: 0, total: 0 }));
  if (override) Object.entries(override).forEach(([id, v]) => { if (net[id]) net[id].round += v; });
  else if (round.stakes === "pot" && entries.length) {
    const sorted = entries.slice().sort((a, b) => b.v - a.v);
    const pays = round.payouts || [];
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
      let share = 0;
      for (let k = i; k <= j; k++) share += Number(pays[k] || 0);
      share /= (j - i + 1);
      for (let k = i; k <= j; k++) net[sorted[k].pl.id].round += share;
      i = j + 1;
    }
    entries.forEach(e => (net[e.pl.id].round -= Number(round.buy_in || 0)));
  }
  if (!override && round.stakes === "point" && entries.length) {
    const rate = Number(round.per_point || 0), n = entries.length, sum = entries.reduce((a, e) => a + e.v, 0);
    entries.forEach(e => (net[e.pl.id].round += rate * (n * e.v - sum)));
  }
  let open = 0;
  bets.forEach(b => {
    if (!b.taker_id || !b.outcome) { open++; return; }
    if (b.outcome === "push") return;
    const w = b.outcome === "creator" ? b.creator_id : b.taker_id;
    const l = b.outcome === "creator" ? b.taker_id : b.creator_id;
    if (net[w]) net[w].bets += Number(b.amount);
    if (net[l]) net[l].bets -= Number(b.amount);
  });
  Object.values(net).forEach(x => {
    x.round = Math.round(x.round * 100) / 100;
    x.bets = Math.round(x.bets * 100) / 100;
    x.total = Math.round((x.round + x.bets) * 100) / 100;
  });
  return { net, open };
}

function settleUp(net) {
  const cred = [], debt = [];
  Object.entries(net).forEach(([id, x]) => {
    const c = Math.round(x.total * 100);
    if (c > 0) cred.push([id, c]); else if (c < 0) debt.push([id, -c]);
  });
  cred.sort((a, b) => b[1] - a[1]);
  debt.sort((a, b) => b[1] - a[1]);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i][1], cred[j][1]);
    out.push({ from: debt[i][0], to: cred[j][0], amount: amt / 100 });
    debt[i][1] -= amt;
    cred[j][1] -= amt;
    if (!debt[i][1]) i++;
    if (!cred[j][1]) j++;
  }
  return out;
}

// One person's share when a prize is split evenly between n people
function moneyEach(amount, n) {
  const c = Math.round(Number(amount || 0) * 100);
  return (c % n ? "about " : "") + moneyFmt(Math.floor(c / n) / 100);
}

// Whole-dollar payouts for 1st, 2nd and 3rd from percentages. 2nd and 3rd round; 1st takes what's left.
function potSplit(pot, pcts) {
  pot = Math.round((pot || 0) * 100) / 100;
  const b = Math.round(pot * pcts[1] / 100), c = Math.round(pot * pcts[2] / 100);
  return [Math.round((pot - b - c) * 100) / 100, b, c];
}

// Buy-in pot fields: buy-in per player, the pot, and 1st / 2nd / 3rd in dollars. Used by rounds and tournaments.
// opts: { payers() -> count, payerText(n) -> "4 players", split: [60, 30, 10], auto: bool (keep the split filled in
//   until someone edits a place), teamSize() -> players sharing each place, buyIn, payouts, onChange }
function potSetup(opts) {
  const box = document.createElement("div");
  box.innerHTML = `
    <label class="money-field"><span>Buy-in per player ($)</span><input data-k="buy" type="number" inputmode="decimal" min="0" step="1" placeholder="20"></label>
    <p class="money-total"></p>
    <div class="money-places">
      ${["1st", "2nd", "3rd"].map((l, i) => `<label class="money-field"><span>${l} ($)</span><input data-k="p${i}" type="number" inputmode="decimal" min="0"><small class="money-each"></small></label>`).join("")}
    </div>
    <button type="button" class="link-btn money-split">Fill in a ${opts.split.join(" / ")} split</button>
    <p class="money-check"></p>`;
  const q = sel => box.querySelector(sel);
  const buyI = q('[data-k="buy"]'), placeI = [0, 1, 2].map(i => q('[data-k="p' + i + '"]'));
  const val = inp => { const v = parseFloat(inp.value); return isNaN(v) || v < 0 ? 0 : Math.round(v * 100) / 100; };
  const count = () => (opts.payers ? opts.payers() : 0);
  const pot = () => Math.round(val(buyI) * count() * 100) / 100;
  if (opts.buyIn) buyI.value = opts.buyIn;
  if (opts.payouts) placeI.forEach((inp, i) => (inp.value = opts.payouts[i] != null ? Number(opts.payouts[i]) : ""));
  // Saved amounts that match the default split still follow the pot when it changes
  let edited = !opts.auto || (!!opts.payouts && opts.payouts.join() !== potSplit(pot(), opts.split).join());
  const fill = () => potSplit(pot(), opts.split).forEach((v, i) => (placeI[i].value = pot() ? v : ""));
  const payouts = () => placeI.map(val);
  const diff = () => Math.round((pot() - payouts().reduce((a, b) => a + b, 0)) * 100) / 100;
  function sync() {
    if (opts.auto && !edited) fill();
    const n = count();
    q(".money-total").textContent = "Pot: " + moneyFmt(pot()) + " (" + (opts.payerText ? opts.payerText(n) : n + (n === 1 ? " player" : " players")) + ")";
    const size = opts.teamSize ? opts.teamSize() : 1;
    box.querySelectorAll(".money-each").forEach((s, i) => {
      const v = payouts()[i];
      s.textContent = size > 1 && v ? moneyEach(v, size) + " each" : "";
    });
    q(".money-split").style.display = opts.auto && !edited ? "none" : "";
    const d = diff(), check = q(".money-check");
    check.textContent = !pot() ? "" : d === 0 ? "Payouts match the pot." : d > 0 ? moneyFmt(d) + " left to hand out." : "Payouts are " + moneyFmt(-d) + " over the pot.";
    check.classList.toggle("bad", !!pot() && d !== 0);
  }
  const changed = () => { sync(); if (opts.onChange) opts.onChange(); };
  buyI.oninput = changed;
  placeI.forEach(inp => (inp.oninput = () => { edited = true; changed(); }));
  q(".money-split").onclick = () => {
    if (!pot()) { toast("Enter a buy-in first."); return; }
    fill();
    if (opts.auto) edited = false;
    changed();
  };
  sync();
  return {
    el: box, sync, pot, payouts,
    buyIn: () => val(buyI),
    // null when it's good to go, otherwise what to fix
    problem: () => (!pot() ? "Enter a buy-in, or turn off Play for money."
      : diff() !== 0 ? "Payouts need to add up to the " + moneyFmt(pot()) + " pot." : null),
  };
}

if (typeof module !== "undefined") module.exports = { moneyFmt, moneySigned, settleUp, potSplit };
