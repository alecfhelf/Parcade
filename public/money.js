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
