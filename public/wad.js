// ---------- Wad ----------
function wadState(players, wads, groupNo) {
  const grp = players.filter(p => p.group_no === groupNo);
  const ids = new Set(grp.map(p => p.id));
  const list = wads.filter(w => ids.has(w.player_id))
    .sort((a, b) => a.hole - b.hole || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  let units = 0, holder = null;
  list.forEach(w => {
    units += w.birdie ? 2 : 1;
    if (w.hole < 16 || w.birdie || w.par_or_better) holder = w.player_id;
  });
  return { grp, units, holder, count: list.length };
}

function wadHolders(players, wads) {
  const s = new Set();
  [...new Set(players.map(p => p.group_no))].forEach(g => { const h = wadState(players, wads, g).holder; if (h) s.add(h); });
  return s;
}

function wadMoney(round, players, wads) {
  const out = {};
  players.forEach(p => (out[p.id] = 0));
  const per = Number(round.per_point || 0);
  [...new Set(players.map(p => p.group_no))].forEach(g => {
    const st = wadState(players, wads, g);
    if (!st.holder || !per) return;
    const amt = st.units * per;
    st.grp.forEach(p => { out[p.id] += p.id === st.holder ? amt * (st.grp.length - 1) : -amt; });
  });
  return out;
}
