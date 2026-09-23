// ---------- Skins ----------
function skinsState(round, players, scores) {
  const allow = holeAllowances(round, players);
  const totals = {}, holes = {};
  players.forEach(p => (totals[p.id] = 0));
  let carry = 0;
  for (let h = 1; h <= 18; h++) {
    const pot = carry + 1;
    const info = { pot, winner: null, result: null };
    holes[h] = info;
    const hs = players.map(p => scores.find(x => x.player_id === p.id && x.hole === h && x.strokes));
    if (!players.length || hs.some(x => !x)) { carry = pot; continue; }
    const nets = hs.map(x => netOf(x, allow));
    const best = Math.min(...nets);
    const winners = players.filter((p, i) => nets[i] === best);
    if (winners.length === 1) { totals[winners[0].id] += pot; info.winner = winners[0]; info.result = "won"; carry = 0; }
    else { info.result = "carry"; carry = pot; }
  }
  return { totals, holes };
}
