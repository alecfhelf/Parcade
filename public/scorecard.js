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

function renderScorecard(box, { round, players, scores, results, user }) {
  const party = round.mode !== "stroke";
  const played = scores.filter(x => x.strokes);
  const holes = [...new Set(played.map(x => x.hole))].sort((a, b) => a - b);

  const rows = players.map(pl => {
    const mine = played.filter(x => x.player_id === pl.id);
    const byHole = {};
    mine.forEach(x => (byHole[x.hole] = x.strokes));
    let holePts = 0;
    mine.forEach(m => { holePts += 1 + played.filter(o => o.hole === m.hole && o.strokes > m.strokes).length; });
    const won = results.filter(r => r.winner_id === pl.id && r.points > 0);
    const cursed = results.filter(r => r.winner_id === pl.id && r.points < 0);
    const chPts = [...won, ...cursed].reduce((a, r) => a + r.points, 0);
    return { pl, byHole, thru: mine.length, strokes: mine.reduce((a, x) => a + x.strokes, 0),
             holePts, chPts, won: won.length, cursed: cursed.length, total: holePts + chPts };
  });
  if (party) rows.sort((a, b) => b.total - a.total);
  else { const avg = r => (r.thru ? r.strokes / r.thru : Infinity); rows.sort((a, b) => avg(a) - avg(b)); }
  const headline = r => (party ? r.total + " pts" : (r.thru ? r.strokes + " strokes" : "-"));

  box.innerHTML = "";

  const podium = scEl("div", "podium");
  const labels = ["1st", "2nd", "3rd"];
  [1, 0, 2].forEach(i => {
    const r = rows[i];
    if (!r) return;
    const col = scEl("div", "podium-col place-" + (i + 1));
    col.append(figureEl(r.pl.color, 44, i === 0), scEl("div", "podium-name", r.pl.name), scEl("div", "podium-score", headline(r)), scEl("div", "podium-block", labels[i]));
    podium.append(col);
  });
  box.append(podium);

  box.append(scEl("h3", null, "Final scores"));
  const list = scEl("ul", "player-list");
  rows.forEach((r, i) => {
    const left = scEl("div");
    const nm = scEl("span");
    nm.append((i + 1) + ". ", figureEl(r.pl.color), r.pl.name + (r.pl.user_id === user.id ? " (you)" : ""));
    left.append(nm);
    const sign = r.chPts > 0 ? "+" : "";
    const detail = party
      ? "Holes " + r.holePts + ", challenges " + sign + r.chPts + " (" + r.won + " won, " + r.cursed + (r.cursed === 1 ? " curse" : " curses") + ")"
      : (r.thru ? "Thru " + r.thru + " holes" : "No scores entered");
    left.append(scEl("span", "detail", detail));
    const li = scEl("li");
    li.append(left, scEl("span", null, headline(r)));
    list.append(li);
  });
  box.append(list);

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
  renderAddToSeason(addWrap, round);
}

function renderAddToSeason(wrap, round) {
  const btn = scEl("button", null, "Add to season");
  btn.style.cssText = "width:100%;margin-top:20px";
  const note = scEl("p", "waiting");
  const home = scEl("button", "btn-ghost", "Back to home");
  home.style.cssText = "width:100%;margin-top:10px";
  home.onclick = () => (location.href = "/");
  wrap.append(btn, note, home);
  btn.onclick = async () => {
    const { data: { session } } = await db.auth.getSession();
    const u = session && session.user;
    if (!u || u.is_anonymous) { note.textContent = "Create an account on the home screen to use seasons."; return; }
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
