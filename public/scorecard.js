// ---------- Finished round: scorecard ----------
function scEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function pickFrom(title, options) {
  return new Promise(resolve => {
    const wrap = scEl("div", "modal");
    const panel = scEl("div", "modal-panel");
    panel.append(scEl("h2", null, title));
    const list = scEl("div", "pick-list");
    const close = v => { wrap.remove(); resolve(v); };
    options.forEach(o => {
      const b = scEl("button", "mode-tile", o.label);
      if (o.color !== undefined) b.prepend(figureEl(o.color));
      b.disabled = !!o.disabled;
      b.onclick = () => close(o.value);
      list.append(b);
    });
    const cancel = scEl("button", "btn-ghost", "Cancel");
    cancel.style.width = "100%";
    cancel.onclick = () => close(null);
    wrap.onclick = e => { if (e.target === wrap) close(null); };
    panel.append(list, cancel);
    wrap.append(panel);
    document.body.append(wrap);
  });
}

function podiumFigure(color, place) {
  const c = PALETTE.some(p => p[0] === color) ? color : "#8A9BC4";
  const body = '<circle cx="24" cy="10" r="5"/><path d="M24 15V30M24 30L18 46M24 30L30 46"/>';
  let art = "";
  if (place === 0) {
    art = body + '<path d="M24 19L17 24L21 28"/>' +
      '<g class="sword"><path d="M24 19L33 8"/><path d="M33 8L39 -6" stroke="#EAF2FF"/><path d="M37 -7L41 -5" stroke="#EAF2FF"/></g>' +
      '<path class="crown" d="M17.5 5L19 -2L22 2L24 -4L26 2L29 -2L30.5 5Z" fill="#FFD84D" stroke="#FFD84D" stroke-width="1" style="filter:drop-shadow(0 0 4px #FFD84D)"/>';
  } else if (place === 1) {
    art = body + '<path d="M24 19L17 27"/>' +
      '<g class="fist"><path d="M24 19L31 16L32 8"/><circle cx="32" cy="6" r="2.2" fill="' + c + '"/></g>' +
      '<text class="curse" x="35" y="-1" font-size="7" fill="#FF5C7A" stroke="none">#@%!</text>';
  } else if (place === 2) {
    art = body + '<g class="clap-l"><path d="M24 19L17 24L19 28"/></g><g class="clap-r"><path d="M24 19L31 24L29 28"/></g>';
  } else {
    art = '<circle cx="27" cy="14" r="5"/><path d="M24 19Q22 25 24 31M24 31L19 46M24 31L29 46M24 21L20 31M24 21L28 31"/>';
  }
  const w = document.createElement("span");
  w.className = "stick pod-fig pod-" + place;
  w.innerHTML = '<svg width="56" height="56" viewBox="0 0 48 48" overflow="visible" fill="none" stroke="' + c +
    '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="filter:drop-shadow(0 0 4px ' + c + ')">' +
    art + '</svg>';
  return w;
}

function renderMoneySection(box, { round, players, entries, bets, user, override }) {
  const hasStakes = round.stakes === "pot" || round.stakes === "point";
  if (!hasStakes && !bets.length) return;
  const { net, open } = moneyNet(round, entries, players, bets, override);
  box.append(scEl("h3", null, "💵 Payouts"));
  if (hasStakes) box.append(scEl("p", "waiting", moneySummary(round)));

  const list = scEl("ul", "player-list");
  players.slice().sort((a, b) => net[b.id].total - net[a.id].total).forEach(pl => {
    const x = net[pl.id];
    const left = scEl("div");
    const nm = scEl("span");
    nm.append(figureEl(pl.color), pl.name + (pl.user_id === user.id ? " (you)" : ""));
    const parts = [];
    if (hasStakes) parts.push("Round " + moneySigned(x.round));
    if (bets.length) parts.push("bets " + moneySigned(x.bets));
    left.append(nm, scEl("span", "detail", parts.join(", ")));
    const li = scEl("li");
    li.append(left, scEl("span", x.total > 0 ? "money-pos" : x.total < 0 ? "money-neg" : null, moneySigned(x.total)));
    list.append(li);
  });
  box.append(list);

  box.append(scEl("h3", null, "Who pays who"));
  const moves = settleUp(net);
  if (!moves.length) box.append(scEl("p", "waiting", "Everybody's even."));
  else {
    const ul = scEl("ul", "player-list");
    const byId = id => players.find(p => p.id === id) || { name: "?" };
    moves.forEach(mv => {
      const li = scEl("li");
      li.append(scEl("span", null, byId(mv.from).name + " pays " + byId(mv.to).name), scEl("span", "money-pos", moneyFmt(mv.amount)));
      ul.append(li);
    });
    box.append(ul);
  }
  if (open) box.append(scEl("p", "waiting", open + (open === 1 ? " side bet wasn't" : " side bets weren't") + " settled, so " + (open === 1 ? "it doesn't" : "they don't") + " count."));
}

function renderCaddyResults(box, { round, players, scores, user, preds, mulls, bets }) {
  box.innerHTML = "";
  const you = pl => (pl.user_id === user.id ? " (you)" : "");
  const cpts = caddyTotals(preds, mulls);
  const caddies = players.filter(p => p.role === "caddy").map(pl => ({
    pl,
    pts: cpts[pl.id] || 0,
    right: preds.filter(x => x.caddy_id === pl.id && x.points > 0).length,
    calls: preds.filter(x => x.caddy_id === pl.id && x.outcome != null).length,
    mulls: mulls.filter(x => x.caddy_id === pl.id).length,
  })).sort((a, b) => b.pts - a.pts || b.right - a.right);

  if (caddies.length) {
    const awards = scEl("div", "caddy-awards");
    const award = (title, r, kind) => {
      const c = scEl("div", "award award-" + kind);
      c.append(scEl("div", "award-title", title), podiumFigure(r.pl.color, kind === "best" ? 0 : 3),
        scEl("div", "podium-name", r.pl.name), scEl("div", "podium-score", r.pts + " pts"));
      return c;
    };
    awards.append(award("🏆 Best Caddy", caddies[0], "best"));
    if (caddies.length > 1) awards.append(award("💀 Worst Caddy", caddies[caddies.length - 1], "worst"));
    box.append(awards);

    box.append(scEl("h3", null, "Caddies"));
    const cl = scEl("ul", "player-list");
    caddies.forEach((r, i) => {
      const left = scEl("div");
      const nm = scEl("span");
      nm.append((i + 1) + ". ", figureEl(r.pl.color), r.pl.name + you(r.pl));
      left.append(nm, scEl("span", "detail", r.right + " of " + r.calls + " calls right" +
        (r.mulls ? ", " + r.mulls + (r.mulls === 1 ? " mulligan" : " mulligans") + " granted" : "")));
      const li = scEl("li");
      li.append(left, scEl("span", null, r.pts + " pts"));
      cl.append(li);
    });
    box.append(cl);
  }

  const golfers = players.filter(p => p.role !== "caddy");
  const allow = holeAllowances(round, golfers);
  const played = scores.filter(x => x.strokes && golfers.some(g => g.id === x.player_id));
  const grows = golfers.map(pl => {
    const mine = played.filter(x => x.player_id === pl.id);
    const byHole = {};
    mine.forEach(x => (byHole[x.hole] = x.strokes));
    const total = mine.reduce((a, x) => a + x.strokes, 0);
    return { pl, byHole, total, net: total - Math.floor(mine.length * (allow[pl.id] || 0) + 1e-9), thru: mine.length };
  }).sort((a, b) => (a.thru ? a.net / a.thru : Infinity) - (b.thru ? b.net / b.thru : Infinity));

  box.append(scEl("h3", null, "Golfers"));
  const gl = scEl("ul", "player-list");
  grows.forEach((r, i) => {
    const left = scEl("div");
    const nm = scEl("span");
    nm.append((i + 1) + ". ", figureEl(r.pl.color), r.pl.name + you(r.pl));
    left.append(nm, scEl("span", "detail", r.thru ? "Thru " + r.thru + " holes" : "No scores entered"));
    const li = scEl("li");
    li.append(left, scEl("span", null, r.thru ? r.total + " strokes" + (round.handicap ? ", net " + Math.round(r.net) : "") : "-"));
    gl.append(li);
  });
  box.append(gl);

  renderMoneySection(box, { round, players, entries: caddies.map(r => ({ pl: r.pl, v: r.pts })), bets: bets || [], user });

  const holes = [...new Set(played.map(x => x.hole))].sort((a, b) => a - b);
  box.append(scEl("h3", null, "Scorecard"));
  if (!holes.length) box.append(scEl("p", "waiting", "No scores were entered."));
  else {
    const wrap = scEl("div", "sc-wrap");
    const table = scEl("table", "sc-table");
    const head = scEl("tr");
    head.append(scEl("th", null, ""));
    holes.forEach(hn => head.append(scEl("th", null, String(hn))));
    head.append(scEl("th", null, "Tot"));
    table.append(head);
    const bestOn = {};
    holes.forEach(hn => { bestOn[hn] = Math.min(...played.filter(x => x.hole === hn).map(x => x.strokes)); });
    grows.forEach(r => {
      const tr = scEl("tr");
      const nameTd = scEl("td");
      nameTd.append(figureEl(r.pl.color, 16), r.pl.name);
      tr.append(nameTd);
      holes.forEach(hn => {
        const v = r.byHole[hn];
        tr.append(scEl("td", v != null && v === bestOn[hn] ? "best" : null, v == null ? "-" : (v >= 11 ? "11+" : String(v))));
      });
      tr.append(scEl("td", "tot", r.thru ? String(r.total) : "-"));
      table.append(tr);
    });
    wrap.append(table);
    box.append(wrap);
  }

  const addWrap = scEl("div");
  box.append(addWrap);
  renderAddToSeason(addWrap, round, players);
}

function renderScorecard(box, { round, players, scores, results, user, picks, preds, mulls, bets, wads }) {
  if (round.mode === "caddy") return renderCaddyResults(box, { round, players, scores, user, preds: preds || [], mulls: mulls || [], bets: bets || [] });
  const wolf = round.mode === "wolf";
  const skins = round.mode === "skins";
  const match = round.mode === "match";
  const bbb = round.mode === "bbb";
  const best = round.mode === "bestball";
  const vegas = round.mode === "vegas";
  const wadMode = round.mode === "wad";
  const wadHold = wadMode ? wadHolders(players, wads || []) : new Set();
  const vegasTot = vegas ? vegasTotals(round, players, scores) : {};
  const bestTot = best ? bestBallTotals(round, players, scores) : {};
  const bbbCount = (pl, k) => results.filter(x => x.award === k && x.winner_id === pl.id).length;
  const bbbDetail = pl => ["bingo", "bango", "bongo"].map(k => {
    const n = bbbCount(pl, k);
    return n + " " + k[0].toUpperCase() + k.slice(1) + (n === 1 ? "" : "s");
  }).join(", ");
  const matchWon = match ? matchTotals(round, players, scores) : {};
  const party = round.mode !== "stroke" && !wolf && !skins && !match && !bbb && !best && !vegas && !wadMode;
  const skinTot = skins ? skinsState(round, players, scores).totals : {};
  const wolfTot = wolf ? wolfTotals(round, players, scores, picks || []) : {};
  const played = scores.filter(x => x.strokes);
  const allow = holeAllowances(round, players);
  const holes = [...new Set(played.map(x => x.hole))].sort((a, b) => a - b);

  const rows = players.map(pl => {
    const mine = played.filter(x => x.player_id === pl.id);
    const byHole = {};
    mine.forEach(x => (byHole[x.hole] = x.strokes));
    let holePts = 0;
    mine.forEach(m => { holePts += 1 + played.filter(o => o.hole === m.hole && netOf(o, allow) > netOf(m, allow)).length; });
    const won = results.filter(r => r.winner_id === pl.id && r.points > 0);
    const cursed = results.filter(r => r.winner_id === pl.id && r.points < 0);
    const chPts = [...won, ...cursed].reduce((a, r) => a + r.points, 0);
    return { pl, byHole, thru: mine.length, strokes: mine.reduce((a, x) => a + x.strokes, 0),
             holePts, chPts, won: won.length, cursed: cursed.length, total: wolf ? (wolfTot[pl.id] || 0) : skins ? (skinTot[pl.id] || 0) : match ? (matchWon[pl.id] || 0) : bbb ? results.filter(x => x.award && x.winner_id === pl.id).length : best ? (bestTot[pl.id] || 0) : vegas ? (vegasTot[pl.id] || 0) : wadMode ? (wads || []).filter(w => w.player_id === pl.id).length : holePts + chPts };
  });
  if (party || wolf || skins || match || bbb || best || vegas || wadMode) rows.sort((a, b) => b.total - a.total);
  else { const avg = r => (r.thru ? (r.strokes - Math.floor(r.thru * (allow[r.pl.id] || 0) + 1e-9)) / r.thru : Infinity); rows.sort((a, b) => avg(a) - avg(b)); }
  if (wadMode) rows.sort((a, b) => (wadHold.has(b.pl.id) - wadHold.has(a.pl.id)) || b.total - a.total);
  const headline = r => (wadMode ? (wadHold.has(r.pl.id) ? "💰 Won the Wad" : r.total + " made") : match ? r.total + (r.total === 1 ? " hole won" : " holes won") : skins ? r.total + (r.total === 1 ? " skin" : " skins") : (party || wolf || bbb || best || vegas) ? r.total + " pts" : (r.thru ? r.strokes + " strokes" + (round.handicap ? ", net " + Math.round(r.strokes - Math.floor(r.thru * (allow[r.pl.id] || 0) + 1e-9)) : "") : "-"));

  box.innerHTML = "";

  const podium = scEl("div", "podium");
  const labels = ["1st", "2nd", "3rd"];
  [1, 0, 2].forEach(i => {
    const r = rows[i];
    if (!r) return;
    const col = scEl("div", "podium-col place-" + (i + 1));
    col.append(podiumFigure(r.pl.color, i), scEl("div", "podium-name", r.pl.name), scEl("div", "podium-score", headline(r)), scEl("div", "podium-block", labels[i]));
    podium.append(col);
  });
  box.append(podium);
  if (match) {
    const gs = [...new Set(players.map(p => p.group_no))].sort((a, b) => a - b);
    gs.forEach(g => {
      const st = matchState(round, players, scores, g);
      if (st.valid) box.append(scEl("p", "waiting", "⚔️ " + (gs.length > 1 ? "Group " + g + ": " : "") + st.status));
    });
  }

  if (rows.length >= 4) {
    const last = rows[rows.length - 1];
    const lp = scEl("div", "last-place");
    const figs = scEl("div", "last-figs");
    figs.append(scEl("span", "poop", "\u{1F4A9}"), podiumFigure(last.pl.color, 3));
    const txt = scEl("div");
    txt.append(scEl("b", null, last.pl.name + " finished dead last"), scEl("span", "sub", headline(last)));
    lp.append(figs, txt);
    box.append(lp);
  }

  box.append(scEl("h3", null, "Final scores"));
  const list = scEl("ul", "player-list");
  rows.forEach((r, i) => {
    const left = scEl("div");
    const nm = scEl("span");
    nm.append((i + 1) + ". ", figureEl(r.pl.color), r.pl.name + (r.pl.user_id === user.id ? " (you)" : ""));
    left.append(nm);
    const sign = r.chPts > 0 ? "+" : "";
    const detail = wadMode ? r.total + (r.total === 1 ? " Wad made" : " Wads made") : bbb ? bbbDetail(r.pl) : (best || vegas) ? (r.pl.team ? TEAM_NAMES[r.pl.team] : "No team") + (r.thru ? ", thru " + r.thru + " holes" : "") : party
      ? "Holes " + r.holePts + ", challenges " + sign + r.chPts + " (" + r.won + " won, " + r.cursed + (r.cursed === 1 ? " curse" : " curses") + ")"
      : (r.thru ? "Thru " + r.thru + " holes" : "No scores entered");
    left.append(scEl("span", "detail", detail));
    const li = scEl("li");
    const right = scEl("span", null, headline(r));
    if ((party || wolf || skins || match || bbb || best || vegas || wadMode) && r.thru) right.append(scEl("span", "sub-score", " (" + r.strokes + ")"));
    li.append(left, right);
    list.append(li);
  });
  box.append(list);

  const pointsMode = party || wolf || skins || match || bbb || best || vegas || wadMode;
  const entries = rows.filter(r => pointsMode || r.thru).map(r => ({
    pl: r.pl, v: pointsMode ? r.total : -(r.strokes - Math.floor(r.thru * (allow[r.pl.id] || 0) + 1e-9)) }));
  renderMoneySection(box, { round, players, entries, bets: bets || [], user, override: wadMode ? wadMoney(round, players, wads || []) : null });

  box.append(scEl("h3", null, "Scorecard"));
  if (!holes.length) {
    box.append(scEl("p", "waiting", "No scores were entered."));
  } else {
    const wrap = scEl("div", "sc-wrap");
    const table = scEl("table", "sc-table");
    const head = scEl("tr");
    head.append(scEl("th", null, ""));
    holes.forEach(h => head.append(scEl("th", null, String(h))));
    head.append(scEl("th", null, "Tot"));
    table.append(head);
    const bestOn = {};
    holes.forEach(h => { bestOn[h] = Math.min(...played.filter(x => x.hole === h).map(x => x.strokes)); });
    rows.forEach(r => {
      const tr = scEl("tr");
      const nameTd = scEl("td");
      nameTd.append(figureEl(r.pl.color, 16), r.pl.name);
      tr.append(nameTd);
      holes.forEach(h => {
        const v = r.byHole[h];
        tr.append(scEl("td", v != null && v === bestOn[h] ? "best" : null, v == null ? "-" : (v >= 11 ? "11+" : String(v))));
      });
      tr.append(scEl("td", "tot", r.thru ? String(r.strokes) : "-"));
      table.append(tr);
    });
    wrap.append(table);
    box.append(wrap);
  }

  const addWrap = scEl("div");
  box.append(addWrap);
  renderAddToSeason(addWrap, round, players);
}

function renderAddToSeason(wrap, round, players) {
  const btn = scEl("button", null, "Add to season");
  btn.style.cssText = "width:100%;margin-top:20px";
  const note = scEl("p", "waiting");
  const home = scEl("button", "btn-ghost", "Back to home");
  home.style.cssText = "width:100%;margin-top:10px";
  home.onclick = () => (location.href = "/");
  const acct = scEl("div", "chip-row");
  acct.style.justifyContent = "center";
  wrap.append(btn, note, acct, home);
  btn.onclick = async () => {
    const { data: { session } } = await db.auth.getSession();
    const u = session && session.user;
    if (!u || u.is_anonymous) {
      note.textContent = "Seasons need an account. Sign in or make one right here and this round comes with you.";
      acct.innerHTML = "";
      const go = async (fn) => {
        const oldId = u ? u.id : null;
        if (!(await fn())) return;
        const { data: { session: s2 } } = await db.auth.getSession();
        const nu = s2 && s2.user;
        if (!nu || nu.is_anonymous) return;
        const mine = (players || []).find(pl => pl.user_id === oldId);
        if (mine && oldId && nu.id !== oldId) await db.rpc("claim_player", { p_player_id: mine.id });
        acct.innerHTML = "";
        note.textContent = "";
        btn.onclick();
      };
      const mk = (label, fn) => { const b = scEl("button", null, label); b.onclick = () => go(fn); return b; };
      acct.append(mk("Create account", createAccount), mk("Sign in", signIn));
      return;
    }
    const { data: seasons } = await db.from("seasons").select("id, name").eq("owner_id", u.id).order("created_at", { ascending: false });
    if (!seasons || !seasons.length) { note.textContent = "You don't run any seasons yet. Start one from Seasons on the home screen."; return; }
    const { data: already } = await db.from("season_rounds").select("season_id").eq("round_id", round.id);
    const added = new Set((already || []).map(x => x.season_id));
    const choice = await pickFrom("Add to season", seasons.map(s => ({
      label: s.name + (added.has(s.id) ? " (already added)" : ""), value: s, disabled: added.has(s.id)
    })));
    if (!choice) return;
    const { error } = await db.from("season_rounds").insert({ season_id: choice.id, round_id: round.id });
    if (error) { note.textContent = "Couldn't add it: " + error.message; return; }
    note.textContent = "Added to " + choice.name + ".";
  };
}
