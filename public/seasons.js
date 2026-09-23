// ---------- Seasons ----------
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
}
const h3el = (text) => el("h3", { textContent: text });

function pageShell(title, subtitle) {
  document.querySelectorAll(".home-only").forEach(x => (x.style.display = "none"));
  document.querySelectorAll(".sound-home").forEach(x => (x.style.display = ""));
  Sound.music(true);
  document.body.classList.add("in-round");
  document.querySelector("h1").textContent = title;
  document.querySelector("h1 + p").textContent = subtitle;
  document.querySelectorAll(".season-box").forEach(b => b.remove());
  const box = el("div", { className: "lobby season-box" });
  box.style.cssText = "margin-top:16px;width:100%;max-width:360px";
  $("status").before(box);
  return box;
}

const backBtn = (href, text) => el("button", { className: "link-btn", textContent: text, onclick: () => navTo(href) });

async function currentAccount() {
  const { data: { session } } = await db.auth.getSession();
  const u = session && session.user;
  return u && !u.is_anonymous ? u : null;
}

function accountPrompt(box, msg) {
  box.append(
    el("p", { className: "waiting", textContent: msg }),
    el("button", { textContent: "Create account", onclick: async () => { await createAccount(); seasonsRoute(); } }),
    el("button", { className: "btn-ghost", textContent: "Sign in", onclick: async () => { await signIn(); seasonsRoute(); } })
  );
}

async function loadSeasonList() {
  const box = pageShell("Seasons", "Keep score across the whole trip");
  box.append(backBtn("/", "Back to home"), infoLink("How seasons work", () => showRulesModal("Seasons", ["seasons"])));
  await ensureUser();
  const acct = await currentAccount();
  const desk = crabbyDesk();
  box.append(desk);
  crabbyTour(desk, acct ? CRABBY_SEASON.tour : CRABBY_SEASON.tourGuest);
  if (!acct) { accountPrompt(box, "Seasons need an account so your points follow you from round to round."); return; }

  const list = el("ul", { className: "player-list" });
  box.append(
    el("button", { textContent: "Start a season", onclick: startSeason }),
    el("button", { className: "btn-ghost", textContent: "Join with a code", onclick: joinSeasonByCode }),
    h3el("Your seasons"),
    list
  );

  const { data: mem } = await db.from("season_members").select("season_id, seasons(name, code)").eq("user_id", acct.id);
  if (!mem || !mem.length) {
    list.append(el("li", { textContent: "No seasons yet. Start one for the next trip." }));
    return;
  }
  mem.forEach(m => {
    if (!m.seasons) return;
    const li = el("li", {}, el("span", { textContent: m.seasons.name }), el("span", { className: "link-btn", textContent: "Open" }));
    li.style.cursor = "pointer";
    li.onclick = () => navTo("/?s=" + m.seasons.code);
    list.append(li);
  });
}

async function startSeason() {
  const myName = await accountName();
  const vals = await ask("Start a season", [
    { label: "Season name", placeholder: "Scottsdale 2026" },
    { label: "Your name", placeholder: "What the boys call you", max: 20, value: myName }
  ], "Start season");
  if (!vals) return;
  const { data: season, error } = await db.from("seasons").insert({ name: vals[0] }).select().single();
  if (error) { toast("Error: " + error.message); return; }
  const r = await db.from("season_members").insert({ season_id: season.id, name: vals[1] });
  if (r.error) { toast("Error: " + r.error.message); return; }
  navTo("/?s=" + season.code);
}

async function joinSeasonByCode() {
  const vals = await ask("Join a season", [{ label: "Season code", placeholder: "AB12CD", max: 6, upper: true }], "Let's go");
  if (vals) navTo("/?s=" + vals[0].toUpperCase());
}

function roundStandings(round, rp, rs, rr, wp, cpr, cmu, wd) {
  if (round.mode === "caddy") {
    const cp = caddyTotals(cpr || [], cmu || []);
    const cad = rp.filter(p => p.role === "caddy").map(pl => ({ pl, v: cp[pl.id] || 0 })).sort((a, b) => b.v - a.v);
    let cplace = 0;
    cad.forEach((r, i) => {
      if (i === 0 || r.v !== cad[i - 1].v) cplace = i;
      r.place = cplace;
      r.pts = [5, 3, 1][cplace] || 0;
    });
    return cad.concat(roundStandings({ ...round, mode: "stroke" }, rp.filter(p => p.role !== "caddy"), rs, rr, wp));
  }
  const played = rs.filter(x => x.strokes);
  const allow = holeAllowances(round, rp);
  const wolfTot = round.mode === "wolf" ? wolfTotals(round, rp, rs, wp || []) : {};
  const skinTot = round.mode === "skins" ? skinsState(round, rp, rs).totals : {};
  const matchWon = round.mode === "match" ? matchTotals(round, rp, rs) : {};
  const bestTot = round.mode === "bestball" ? bestBallTotals(round, rp, rs) : {};
  const vegasTot = round.mode === "vegas" ? vegasTotals(round, rp, rs) : {};
  const wadHold = round.mode === "wad" ? wadHolders(rp, wd || []) : new Set();
  const rows = rp.map(pl => {
    const mine = played.filter(x => x.player_id === pl.id);
    if (!mine.length) return null;
    if (round.mode === "wolf") return { pl, v: wolfTot[pl.id] || 0 };
    if (round.mode === "skins") return { pl, v: skinTot[pl.id] || 0 };
    if (round.mode === "match") return { pl, v: matchWon[pl.id] || 0 };
    if (round.mode === "bestball") return { pl, v: bestTot[pl.id] || 0 };
    if (round.mode === "vegas") return { pl, v: vegasTot[pl.id] || 0 };
    if (round.mode === "wad") return { pl, v: (wadHold.has(pl.id) ? 1000 : 0) + (wd || []).filter(w => w.player_id === pl.id).length };
    if (round.mode === "bbb") return { pl, v: rr.filter(x => x.award && x.winner_id === pl.id).length };
    if (round.mode === "stroke") {
      const total = mine.reduce((a, x) => a + x.strokes, 0);
      return { pl, v: -((total - (allow[pl.id] || 0) * mine.length) / mine.length) };
    }
    let pts = 0;
    mine.forEach(m => { pts += 1 + played.filter(o => o.hole === m.hole && netOf(o, allow) > netOf(m, allow)).length; });
    rr.filter(r => r.winner_id === pl.id).forEach(r => { pts += r.points; });
    return { pl, v: pts };
  }).filter(Boolean);
  rows.sort((a, b) => b.v - a.v);
  let place = 0;
  rows.forEach((r, i) => {
    if (i === 0 || r.v !== rows[i - 1].v) place = i;
    r.place = place;
    r.pts = [5, 3, 1][place] || 0;
  });
  return rows;
}

async function loadSeason(code) {
  const box = pageShell("Season", "");
  await ensureUser();
  const acct = await currentAccount();
  const { data: season } = await db.from("seasons").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!season) { box.textContent = "Season not found. Check the code."; return; }
  document.querySelector("h1").textContent = season.name;
  document.querySelector("h1 + p").textContent = "Season code: " + season.code;
  const isOwner = !!acct && acct.id === season.owner_id;
  const seasonDesk = crabbyDesk();
  seasonDesk.reserve([CRABBY_SEASON.owner, CRABBY_SEASON.member, CRABBY_SEASON.join, CRABBY_SEASON.guest]);

  const link = location.origin + "/?s=" + season.code;
  const linkInput = el("input", { value: link, readOnly: true, onclick: () => linkInput.select() });
  linkInput.style.cssText = "flex:1;min-width:0;padding:12px;border-radius:10px;font-size:16px";
  const copy = el("button", { textContent: "Copy" });
  copy.style.cssText = "flex:0 0 112px;padding:12px 0;white-space:nowrap";
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(link); } catch (e) { linkInput.select(); document.execCommand("copy"); }
    copy.textContent = "Copied!";
    setTimeout(() => (copy.textContent = "Copy"), 1500);
  };
  const linkRow = el("div", {}, linkInput, copy);
  linkRow.style.cssText = "display:flex;gap:8px;margin-top:8px";

  const joinArea = el("div");
  const standings = el("ul", { className: "player-list" });
  const moneyArea = el("div");
  const roundsList = el("ul", { className: "player-list" });
  const addArea = el("div");
  box.append(backBtn("/?seasons", "All seasons"), infoLink("How seasons work", () => showRulesModal("Seasons", ["seasons"])), seasonDesk, linkRow, joinArea,
    h3el("Standings"), standings, moneyArea, h3el("Rounds"), roundsList, addArea);

  async function refresh() {
    const [{ data: members }, { data: sr }] = await Promise.all([
      db.from("season_members").select("*").eq("season_id", season.id).order("created_at"),
      db.from("season_rounds").select("round_id").eq("season_id", season.id),
    ]);
    const ids = (sr || []).map(x => x.round_id);
    let rounds = [], players = [], scores = [], results = [], picks = [], cpreds = [], cmulls = [], sbets = [], swads = [];
    if (ids.length) {
      const res = await Promise.all([
        db.from("rounds").select("*").in("id", ids).order("created_at"),
        db.from("players").select("*").in("round_id", ids),
        db.from("scores").select("*").in("round_id", ids),
        db.from("challenge_results").select("*").in("round_id", ids),
        db.from("wolf_picks").select("*").in("round_id", ids),
        db.from("predictions").select("*").in("round_id", ids),
        db.from("mulligans").select("*").in("round_id", ids),
        db.from("bets").select("*").in("round_id", ids),
        db.from("wads").select("*").in("round_id", ids),
      ]);
      [rounds, players, scores, results, picks, cpreds, cmulls, sbets, swads] = res.map(r => r.data || []);
    }
    renderJoin(members || []);
    renderStandings(members || [], rounds, players, scores, results, picks, cpreds, cmulls, swads);
    renderMoneyStats(members || [], rounds, players, scores, results, picks, cpreds, cmulls, sbets, swads);
    renderRounds(rounds);
    if (isOwner) renderAdd(ids);
  }

  function renderJoin(members) {
    joinArea.innerHTML = "";
    const joined = !!acct && members.some(m => m.user_id === acct.id);
    seasonDesk.say(!acct ? CRABBY_SEASON.guest : isOwner ? CRABBY_SEASON.owner : joined ? CRABBY_SEASON.member : CRABBY_SEASON.join);
    if (!acct) { accountPrompt(joinArea, "Create an account or sign in to join this season."); return; }
    if (members.some(m => m.user_id === acct.id)) return;
    const b = el("button", { textContent: "Join this season" });
    b.style.cssText = "width:100%;margin-top:10px";
    b.onclick = async () => {
      const joinName = await accountName();
      const vals = await ask("Join " + season.name, [{ label: "Your name", placeholder: "What the boys call you", max: 20, value: joinName }], "I'm in");
      if (!vals) return;
      const { error } = await db.from("season_members").insert({ season_id: season.id, name: vals[0] });
      if (error) { toast("Error: " + error.message); return; }
      refresh();
    };
    joinArea.append(b);
  }

  function renderStandings(members, rounds, players, scores, results, picks, cpreds, cmulls, swads) {
    const memberById = new Map(members.map(m => [m.user_id, m]));
    const totals = new Map();
    members.forEach(m => totals.set("u:" + m.user_id, { name: m.name, pts: 0, wins: 0, rounds: 0 }));
    rounds.forEach(round => {
      const rows = roundStandings(round,
        players.filter(p => p.round_id === round.id),
        scores.filter(x => x.round_id === round.id),
        results.filter(x => x.round_id === round.id),
        picks.filter(x => x.round_id === round.id),
        cpreds.filter(x => x.round_id === round.id),
        cmulls.filter(x => x.round_id === round.id),
        swads.filter(x => x.round_id === round.id));
      rows.forEach(r => {
        const m = memberById.get(r.pl.user_id);
        const key = m ? "u:" + r.pl.user_id : "n:" + r.pl.name.trim().toLowerCase();
        if (!totals.has(key)) totals.set(key, { name: r.pl.name, pts: 0, wins: 0, rounds: 0 });
        const t = totals.get(key);
        t.pts += r.pts;
        t.rounds += 1;
        if (r.place === 0) t.wins += 1;
      });
    });
    const rows = [...totals.values()].sort((a, b) => b.pts - a.pts || b.wins - a.wins);
    standings.innerHTML = "";
    if (!rows.length) { standings.append(el("li", { textContent: "No one here yet." })); return; }
    rows.forEach((t, i) => {
      standings.append(el("li", {},
        el("span", { textContent: (i + 1) + ". " + t.name }),
        el("span", { textContent: t.pts + " pts, " + t.wins + (t.wins === 1 ? " win" : " wins") })));
    });
  }

  function renderMoneyStats(members, rounds, players, scores, results, picks, cpreds, cmulls, sbets, swads) {
    moneyArea.innerHTML = "";
    const staked = r => r.stakes === "pot" || r.stakes === "point";
    const moneyRounds = rounds.filter(r => staked(r) || sbets.some(b => b.round_id === r.id));
    if (!moneyRounds.length) return;
    const memberById = new Map(members.map(m => [m.user_id, m]));
    const keyOf = pl => (memberById.has(pl.user_id) ? "u:" + pl.user_id : "n:" + pl.name.trim().toLowerCase());
    const nameOf = pl => (memberById.has(pl.user_id) ? memberById.get(pl.user_id).name : pl.name);
    const stats = new Map();
    const get = pl => {
      const k = keyOf(pl);
      if (!stats.has(k)) stats.set(k, { name: nameOf(pl), net: 0, best: null, worst: null, won: 0, lost: 0, push: 0 });
      return stats.get(k);
    };

    moneyRounds.forEach(round => {
      const of = arr => arr.filter(x => x.round_id === round.id);
      const rp = of(players), rs = of(scores), rr = of(results), wp = of(picks), cpr = of(cpreds), cmu = of(cmulls), rb = of(sbets);
      let entries;
      if (round.mode === "caddy") {
        const cp = caddyTotals(cpr, cmu);
        entries = rp.filter(p => p.role === "caddy").map(pl => ({ pl, v: cp[pl.id] || 0 }));
      } else if (round.mode === "stroke") {
        const allow = holeAllowances(round, rp);
        entries = rp.map(pl => {
          const mine = rs.filter(x => x.player_id === pl.id && x.strokes);
          if (!mine.length) return null;
          const total = mine.reduce((a, x) => a + x.strokes, 0);
          return { pl, v: -(total - (allow[pl.id] || 0) * mine.length) };
        }).filter(Boolean);
      } else {
        entries = roundStandings(round, rp, rs, rr, wp, cpr, cmu, of(swads)).map(r => ({ pl: r.pl, v: r.v }));
      }
      const { net } = moneyNet(round, entries, rp, rb, round.mode === "wad" ? wadMoney(round, rp, of(swads)) : null);
      rp.forEach(pl => {
        const inRound = staked(round) && entries.some(e => e.pl.id === pl.id);
        const inBets = rb.some(b => b.creator_id === pl.id || b.taker_id === pl.id);
        if (!inRound && !inBets) return;
        const s = get(pl), t = net[pl.id].total;
        s.net += t;
        s.best = s.best == null ? t : Math.max(s.best, t);
        s.worst = s.worst == null ? t : Math.min(s.worst, t);
      });
      rb.forEach(b => {
        if (!b.taker_id || !b.outcome) return;
        const cr = rp.find(p => p.id === b.creator_id), tk = rp.find(p => p.id === b.taker_id);
        if (b.outcome === "push") { if (cr) get(cr).push++; if (tk) get(tk).push++; return; }
        const w = b.outcome === "creator" ? cr : tk, l = b.outcome === "creator" ? tk : cr;
        if (w) get(w).won++;
        if (l) get(l).lost++;
      });
    });

    moneyArea.append(h3el("💵 Money"));
    const ul = el("ul", { className: "player-list" });
    [...stats.values()].sort((a, b) => b.net - a.net).forEach(s => {
      const parts = [];
      if (s.best != null && s.best > 0) parts.push("Biggest win " + moneySigned(s.best));
      if (s.worst != null && s.worst < 0) parts.push("biggest loss " + moneySigned(s.worst));
      const decided = s.won + s.lost;
      if (decided || s.push) parts.push("side bets " + s.won + "-" + s.lost + (s.push ? "-" + s.push : "") + (decided ? " (" + Math.round(s.won / decided * 100) + "%)" : ""));
      const left = el("div", {}, el("span", { textContent: s.name }), el("span", { className: "detail", textContent: parts.join(", ") || "No money moved yet" }));
      ul.append(el("li", {}, left, el("span", { className: s.net > 0 ? "money-pos" : s.net < 0 ? "money-neg" : "", textContent: moneySigned(s.net) })));
    });
    moneyArea.append(ul);
  }

  function renderRounds(rounds) {
    roundsList.innerHTML = "";
    if (!rounds.length) {
      roundsList.append(el("li", { textContent: isOwner ? "No rounds yet. Add one below." : "No rounds added yet." }));
      return;
    }
    rounds.forEach(r => {
      const mode = MODES[r.mode] ? MODES[r.mode].name : "Not started";
      const name = el("span", { textContent: r.name + " (" + mode + ")" });
      name.style.cursor = "pointer";
      name.onclick = () => openRound(r.code);
      const li = el("li", {}, name);
      if (isOwner) {
        li.append(el("button", { className: "link-btn", textContent: "Remove", onclick: async () => {
          const { error } = await db.from("season_rounds").delete().eq("season_id", season.id).eq("round_id", r.id);
          if (error) { toast("Error: " + error.message); return; }
          refresh();
        } }));
      }
      roundsList.append(li);
    });
  }

  async function renderAdd(ids) {
    addArea.innerHTML = "";
    const { data: mine } = await db.from("players").select("round_id").eq("user_id", acct.id);
    const myIds = [...new Set((mine || []).map(x => x.round_id))].filter(id => !ids.includes(id));
    addArea.append(h3el("Add your rounds"));
    const list = el("ul", { className: "player-list" });
    addArea.append(list);
    if (!myIds.length) { list.append(el("li", { textContent: "Play a round and it shows up here." })); return; }
    const { data: rounds } = await db.from("rounds").select("*").in("id", myIds).order("created_at", { ascending: false });
    (rounds || []).forEach(r => {
      list.append(el("li", {},
        el("span", { textContent: r.name }),
        el("button", { className: "link-btn", textContent: "Add", onclick: async () => {
          const { error } = await db.from("season_rounds").insert({ season_id: season.id, round_id: r.id });
          if (error) { toast("Error: " + error.message); return; }
          refresh();
        } })));
    });
  }

  await refresh();
}

const seasonBtn = $("seasons-btn");
if (seasonBtn) seasonBtn.onclick = () => navTo("/?seasons");
const HOME_H1 = document.querySelector("h1").innerHTML;
const HOME_SUB = document.querySelector("h1 + p").textContent;

function seasonsRoute() {
  window.scrollTo(0, 0);
  const sp = new URLSearchParams(location.search);
  if (sp.has("seasons")) loadSeasonList();
  else if (sp.get("s")) loadSeason(sp.get("s"));
}

function showHomeView() {
  document.querySelectorAll(".season-box").forEach(b => b.remove());
  document.body.classList.remove("in-round");
  document.querySelector("h1").innerHTML = HOME_H1;
  document.querySelector("h1 + p").textContent = HOME_SUB;
  document.querySelectorAll(".home-only").forEach(x => (x.style.display = ""));
  Sound.music(true);
  window.scrollTo(0, 0);
}

function navTo(url) {
  history.pushState({}, "", url);
  if (url === "/") showHomeView(); else seasonsRoute();
}

seasonsRoute();
