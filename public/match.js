// ---------- Match Play ----------
function matchStatusText(diff, left, a, b) {
  if (diff === 0) return "All square";
  const lead = diff > 0 ? a : b, n = Math.abs(diff);
  if (left === 0) return lead.name + " wins " + n + " UP";
  if (n > left) return lead.name + " wins " + n + "&" + left;
  if (n === left) return lead.name + " " + n + " UP, dormie";
  return lead.name + " " + n + " UP";
}

function matchMultiText(grp, won, left, final) {
  const sorted = grp.slice().sort((x, y) => won[y.id] - won[x.id]);
  const top = sorted[0], topWon = won[top.id];
  const tied = sorted.filter(p => won[p.id] === topWon);
  const names = tied.map(p => p.name).join(", ");
  if (final) return tied.length > 1 ? "Match halved: " + names : top.name + " wins with " + topWon + (topWon === 1 ? " hole" : " holes");
  if (topWon === 0) return "All square";
  if (tied.length > 1) return "All square at the top: " + names;
  const m = topWon - won[sorted[1].id];
  return top.name + " leads by " + m + (m === left ? ", dormie" : "");
}

function matchState(round, players, scores, groupNo) {
  const grp = players.filter(p => groupNo == null || p.group_no === groupNo)
    .sort((x, y) => (x.created_at < y.created_at ? -1 : x.created_at > y.created_at ? 1 : 0));
  const out = { valid: grp.length >= 2, holes: {}, won: {}, clinched: false, status: "All square" };
  grp.forEach(p => (out.won[p.id] = 0));
  if (!out.valid) return out;
  const allow = holeAllowances(round, players);
  const scoreOf = (p, h) => scores.find(x => x.player_id === p.id && x.hole === h && x.strokes);
  const statusNow = (played, final) => {
    const left = 18 - played;
    if (grp.length === 2) {
      const diff = out.won[grp[0].id] - out.won[grp[1].id];
      return final && diff === 0 ? "Match halved" : matchStatusText(diff, left, grp[0], grp[1]);
    }
    return matchMultiText(grp, out.won, left, final);
  };
  let played = 0;
  for (let h = 1; h <= 18; h++) {
    out.holes[h] = { before: statusNow(played, false), result: null };
    const hs = grp.map(p => scoreOf(p, h));
    if (hs.some(x => !x)) continue;
    const nets = hs.map(x => netOf(x, allow));
    const best = Math.min(...nets);
    const winners = grp.filter((p, i) => nets[i] === best);
    if (winners.length === 1) { out.won[winners[0].id]++; out.holes[h].result = winners[0].name + " won the hole."; }
    else out.holes[h].result = "Halved.";
    played++;
    if (!out.clinched) {
      const w = grp.map(p => out.won[p.id]).sort((a, b) => b - a);
      if (played === 18) { out.clinched = true; out.status = statusNow(played, true); }
    }
  }
  if (!out.clinched) out.status = statusNow(played, false);
  return out;
}

function matchTotals(round, players, scores) {
  const won = {};
  [...new Set(players.map(p => p.group_no))].forEach(g => Object.assign(won, matchState(round, players, scores, g).won));
  return won;
}
