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
  dropSeasonChannel();
  dropTournamentChannel();
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

  const { data: mem } = await db.from("season_members").select("season_id, seasons(*)").eq("user_id", acct.id);
  if (!mem || !mem.length) {
    list.append(el("li", { textContent: "No seasons yet. Start one for the next trip." }));
    return;
  }
  const roundsIds = mem.filter(m => m.seasons && m.seasons.format === "rounds" && !m.seasons.ended_at).map(m => m.season_id);
  let allMembers = [], allEntries = [];
  if (roundsIds.length) {
    const res = await Promise.all([
      db.from("season_members").select("season_id, user_id").in("season_id", roundsIds),
      db.from("season_entries").select("season_id, user_id").in("season_id", roundsIds),
    ]);
    [allMembers, allEntries] = res.map(r => r.data || []);
  }
  mem.forEach(m => {
    if (!m.seasons) return;
    let left = el("span", { textContent: m.seasons.name });
    if (m.seasons.format && m.seasons.format !== "legacy") {
      const counts = new Map();
      allEntries.filter(e => e.season_id === m.season_id).forEach(e => counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1));
      const status = seasonStatus(m.seasons, allMembers.filter(x => x.season_id === m.season_id), counts);
      left = el("div", {}, left, el("span", { className: "detail", textContent: seasonFormatLine(m.seasons) + " · " + SEASON_STATUS[status] }));
    }
    const li = el("li", {}, left, el("span", { className: "link-btn", textContent: "Open" }));
    li.style.cursor = "pointer";
    li.onclick = () => navTo("/?s=" + m.seasons.code);
    list.append(li);
  });
}

async function startSeason() {
  const form = await seasonFormModal(await accountName());
  if (!form) return;
  const hcp = await askSeasonHandicap(null);
  if (hcp == null) return;
  const row = { name: form.name, format: form.format, rounds_count: form.count };
  if (form.format === "dates") { row.starts_at = form.starts_at; row.ends_at = form.ends_at; }
  const { data: season, error } = await db.from("seasons").insert(row).select().single();
  if (error) { toast("Error: " + error.message); return; }
  const r = await db.from("season_members").insert({ season_id: season.id, name: form.me, handicap: hcp });
  if (r.error) { toast("Error: " + r.error.message); return; }
  navTo("/?s=" + season.code);
}

async function joinSeasonByCode() {
  const vals = await ask("Join a season", [{ label: "Season code", placeholder: "AB12CD", max: 6, upper: true }], "Let's go");
  if (vals) navTo("/?s=" + vals[0].toUpperCase());
}

function inviteRow(season) {
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
  return linkRow;
}

function renderSeasonMoney(moneyArea, aliasMap, members, rounds, players, scores, results, picks, cpreds, cmulls, sbets, swads) {
  moneyArea.innerHTML = "";
  const staked = r => r.stakes === "pot" || r.stakes === "point";
  const moneyRounds = rounds.filter(r => staked(r) || sbets.some(b => b.round_id === r.id));
  if (!moneyRounds.length) return;
  const memberById = new Map(members.map(m => [m.user_id, m]));
  const uidOf = pl => (memberById.has(pl.user_id) ? pl.user_id : aliasMap.get(pl.name.trim().toLowerCase()));
  const keyOf = pl => (uidOf(pl) ? "u:" + uidOf(pl) : "n:" + pl.name.trim().toLowerCase());
  const nameOf = pl => (uidOf(pl) && memberById.has(uidOf(pl)) ? memberById.get(uidOf(pl)).name : pl.name);
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
        return { pl, v: -(total - Math.floor(mine.length * (allow[pl.id] || 0) + 1e-9)) };
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
      return { pl, v: -((total - Math.floor(mine.length * (allow[pl.id] || 0) + 1e-9)) / mine.length) };
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
  if (season.format && season.format !== "legacy") return loadSeasonV2(box, season, acct);
  const isOwner = !!acct && acct.id === season.owner_id;
  const seasonDesk = crabbyDesk();
  seasonDesk.reserve([CRABBY_SEASON.owner, CRABBY_SEASON.member, CRABBY_SEASON.join, CRABBY_SEASON.guest]);

  const linkRow = inviteRow(season);

  const joinArea = el("div");
  const standings = el("ul", { className: "player-list" });
  const moneyArea = el("div");
  const aliasArea = el("div");
  let aliasMap = new Map(), lastPlayers = [];
  const roundsList = el("ul", { className: "player-list" });
  const addArea = el("div");
  box.append(backBtn("/?seasons", "All seasons"), infoLink("How seasons work", () => showRulesModal("Seasons", ["seasons"])), seasonDesk, linkRow, joinArea,
    h3el("Standings"), standings, aliasArea, moneyArea, h3el("Rounds"), roundsList, addArea);
  if (isOwner) box.append(deleteSeasonButton(season));
  const seasonGone = watchSeasonGone(box, season);

  async function refresh() {
    if (await seasonGone()) return;
    const [{ data: members }, { data: sr }, { data: al }] = await Promise.all([
      db.from("season_members").select("*").eq("season_id", season.id).order("created_at"),
      db.from("season_rounds").select("round_id").eq("season_id", season.id),
      db.from("season_aliases").select("*").eq("season_id", season.id),
    ]);
    aliasMap = new Map((al || []).map(a => [a.alias, a.user_id]));
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
    renderSeasonMoney(moneyArea, aliasMap, members || [], rounds, players, scores, results, picks, cpreds, cmulls, sbets, swads);
    lastPlayers = players;
    renderAliases(members || [], players);
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
      await claimNamesFlow(vals[0], members);
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
        const uid = memberById.has(r.pl.user_id) ? r.pl.user_id : aliasMap.get(r.pl.name.trim().toLowerCase());
        const key = uid ? "u:" + uid : "n:" + r.pl.name.trim().toLowerCase();
        if (!totals.has(key)) totals.set(key, { name: uid && memberById.has(uid) ? memberById.get(uid).name : r.pl.name, pts: 0, wins: 0, rounds: 0 });
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

  function candidateNames(members, extraIds) {
    const memberIds = new Set(members.map(m => m.user_id).concat(extraIds || []));
    const names = new Map();
    lastPlayers.forEach(p => {
      if (memberIds.has(p.user_id)) return;
      const k = p.name.trim().toLowerCase();
      if (!names.has(k)) names.set(k, p.name.trim());
    });
    return names;
  }

  async function claimNamesFlow(typed, members) {
    const names = candidateNames(members, [acct.id]);
    if (!names.size) return;
    const t = typed.trim().toLowerCase();
    const opts = [...names].map(([k, label]) => ({ key: k, label, checked: k === t && !aliasMap.has(k), disabled: aliasMap.has(k) }));
    const picked = await pickNames("Which of these are you?",
      "Tap every name you've played under in this season's rounds. Your points get combined.", opts);
    if (!picked || !picked.length) return;
    const { error } = await db.from("season_aliases").insert(picked.map(k => ({ season_id: season.id, alias: k, user_id: acct.id })));
    if (error) toast(error.code === "23505" ? "One of those names was already claimed." : error.message);
  }

  function renderAliases(members, players) {
    aliasArea.innerHTML = "";
    if (!acct) return;
    const names = candidateNames(members);
    if (!names.size) return;
    const isMember = members.some(m => m.user_id === acct.id);
    if (!isOwner && !isMember) return;
    aliasArea.append(h3el("Who's who"), el("p", { className: "waiting",
      textContent: isOwner ? "Tap the names each person played under. Their rounds get combined." : "Tap every name you've played under. Your rounds get combined." }));
    (isOwner ? members : members.filter(m => m.user_id === acct.id)).forEach(m => {
      const block = el("div", { className: "alias-block" });
      block.append(el("div", { className: "alias-name", textContent: m.name + (m.user_id === acct.id ? " (you)" : "") }));
      const row = el("div", { className: "chip-row" });
      names.forEach((display, k) => {
        const owner = aliasMap.get(k);
        const mine = owner === m.user_id;
        const b = el("button", { textContent: display });
        b.classList.toggle("selected", mine);
        b.disabled = !!owner && !mine && !isOwner;
        if (owner && !mine) b.title = "Claimed by " + ((members.find(x => x.user_id === owner) || {}).name || "someone");
        b.onclick = () => toggleAlias(k, m.user_id, mine, owner);
        row.append(b);
      });
      block.append(row);
      aliasArea.append(block);
    });
  }

  async function toggleAlias(k, uid, mine, owner) {
    let error;
    if (mine) {
      ({ error } = await db.from("season_aliases").delete().eq("season_id", season.id).eq("alias", k));
    } else {
      if (owner) {
        const d = await db.from("season_aliases").delete().eq("season_id", season.id).eq("alias", k);
        if (d.error) { toast(d.error.message); return; }
      }
      ({ error } = await db.from("season_aliases").insert({ season_id: season.id, alias: k, user_id: uid }));
    }
    if (error) { toast(error.code === "23505" ? "Someone already claimed that name." : error.message); return; }
    refresh();
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
    await loadRoundRanks((rounds || []).map(r => r.id));
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

// ---------- Seasons v2: rounds and dates formats ----------
const SEASON_STATUS = { upcoming: "Upcoming", active: "Active", final: "Final" };
let seasonChannel = null;
function deleteSeasonButton(season) {
  const wrap = el("div", { className: "danger-row" });
  wrap.append(el("button", { className: "link-btn danger", textContent: "Delete season", onclick: async () => {
    const ok = await ask("Delete " + season.name + "?", [], "Delete season",
      "This removes the season and its standings for everyone. Rounds aren't deleted. This can't be undone.", async () => {
        const { error } = await db.rpc("delete_season", { p_season: season.id });
        return error ? error.message : null;
      });
    if (ok) navTo("/?seasons");
  } }));
  return wrap;
}

// Checks now and then whether the season still exists; if not, swaps the page for a "deleted" note.
function watchSeasonGone(box, season) {
  let done = false;
  const check = async () => {
    if (done) return true;
    if (!box.isConnected) { stop(); return false; }
    const { data, error } = await db.from("seasons").select("id").eq("id", season.id).maybeSingle();
    if (error || data || !box.isConnected) return false;
    stop();
    dropSeasonChannel();
    showDeleted(box, "season");
    return true;
  };
  const onVis = () => { if (!document.hidden) check(); };
  const timer = setInterval(() => { if (!document.hidden) check(); }, 15000);
  const stop = () => { done = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  document.addEventListener("visibilitychange", onVis);
  return check;
}

function dropSeasonChannel() {
  if (seasonChannel) { db.removeChannel(seasonChannel); seasonChannel = null; }
}

const shortDate = d => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmt1 = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
const hcpText = h => (h < 0 ? "+" + fmt1(-h) : fmt1(h));

function seasonFormatLine(season) {
  if (season.format === "rounds") return season.rounds_count + " rounds each";
  if (season.format === "dates") return shortDate(season.starts_at) + " to " + shortDate(season.ends_at) + ", best " + season.rounds_count;
  return "";
}

function diffBadge(diff) {
  return el("span", { className: "diff-badge" + (diff.source === "default" ? " warn" : ""), textContent: difficultyBadge(diff), title: diff.detail });
}

const courseName = c => (c ? c.name + (c.tee_name ? " (" + c.tee_name + ")" : "") : "No course");

// Most recent handicap this account played a round with, if any
async function lastRoundHandicap(uid) {
  const { data } = await db.from("players").select("hcp, usual_score").eq("user_id", uid)
    .or("hcp.not.is.null,usual_score.not.is.null").order("created_at", { ascending: false }).limit(1);
  const p = data && data[0];
  if (!p) return null;
  return p.hcp != null ? Number(p.hcp) : Math.max(-10, Math.min(54, p.usual_score - 72));
}

// Returns a handicap from -10 to 54, or null if cancelled. "I don't know" converts usual score - 72.
async function askSeasonHandicap(name, current) {
  const acct = await currentAccount();
  const pre = current != null ? Number(current) : acct ? await lastRoundHandicap(acct.id) : null;
  const hc = await askHandicap(name, pre != null ? { hcp: pre, usual: Math.round(72 + pre) } : null, pre != null);
  if (!hc) return null;
  return hc.hcp != null ? hc.hcp : Math.max(-10, Math.min(54, hc.usual - 72));
}

const isoDay = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dayOf = v => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };

function seasonFormModal(myName) {
  return new Promise(resolve => {
    const wrap = el("div", { className: "modal" });
    const panel = el("form", { className: "modal-panel" });
    const field = (label, input) => el("label", {}, el("span", { textContent: label }), input);
    const nameI = el("input", { placeholder: "Scottsdale 2026", maxLength: 40, autocomplete: "off" });
    const meI = el("input", { placeholder: "What the boys call you", maxLength: 20, autocomplete: "off", value: myName || "" });

    let format = "rounds", count = 5;
    const fmtBtn = (key, text) => el("button", { type: "button", className: "switch", textContent: text, onclick: () => { format = key; draw(); } });
    const fmtRounds = fmtBtn("rounds", "Rounds"), fmtDates = fmtBtn("dates", "Dates");
    fmtRounds.setAttribute("role", "radio");
    fmtDates.setAttribute("role", "radio");
    const fmtHint = el("small");
    const fmtRow = el("div", { className: "toggle-row" },
      el("div", {}, el("span", { className: "field-label", textContent: "Format" }), fmtHint),
      el("div", { className: "fmt-pick" }, fmtRounds, fmtDates));
    fmtRow.lastChild.setAttribute("role", "radiogroup");

    const cntLbl = el("span", { className: "field-label" });
    const cntHint = el("small");
    const down = el("button", { type: "button", className: "mini", textContent: "−", onclick: () => { count = Math.max(1, count - 1); draw(); } });
    const up = el("button", { type: "button", className: "mini", textContent: "+", onclick: () => { count = Math.min(20, count + 1); draw(); } });
    down.setAttribute("aria-label", "Fewer rounds");
    up.setAttribute("aria-label", "More rounds");
    const cntVal = el("b");
    const cntRow = el("div", { className: "toggle-row" }, el("div", {}, cntLbl, cntHint), el("div", { className: "stepper" }, down, cntVal, up));

    const today = new Date();
    const later = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate() - 1);
    const startI = el("input", { type: "date", value: isoDay(today) });
    const endI = el("input", { type: "date", value: isoDay(later) });
    const dateBox = el("div", {}, field("First day", startI), field("Last day", endI));

    const draw = () => {
      const dates = format === "dates";
      fmtRounds.classList.toggle("on", !dates);
      fmtDates.classList.toggle("on", dates);
      fmtRounds.setAttribute("aria-checked", String(!dates));
      fmtDates.setAttribute("aria-checked", String(dates));
      fmtHint.textContent = dates ? "Play as much as you want between two dates." : "Everybody gets the same number of rounds.";
      cntLbl.textContent = dates ? "Best rounds that count" : "Rounds each";
      cntHint.textContent = dates ? "Your best " + count + " count. The rest are practice." : "Each player adds up to " + count + ".";
      cntVal.textContent = count;
      down.disabled = count <= 1;
      up.disabled = count >= 20;
      dateBox.style.display = dates ? "" : "none";
    };
    draw();

    const err = el("p", { className: "modal-error" });
    err.setAttribute("role", "alert");
    const close = v => { wrap.remove(); resolve(v); };
    const cancel = el("button", { type: "button", className: "btn-ghost", textContent: "Cancel", onclick: () => close(null) });
    const ok = el("button", { type: "submit", textContent: "Next" });
    panel.append(el("h2", { textContent: "Start a season" }), field("Season name", nameI), field("Your name", meI),
      fmtRow, cntRow, dateBox, err, el("div", { className: "modal-actions" }, cancel, ok));
    panel.onsubmit = e => {
      e.preventDefault();
      err.textContent = "";
      const name = nameI.value.trim(), me = meI.value.trim();
      if (!name) { nameI.focus(); return; }
      if (!me) { meI.focus(); return; }
      const out = { name, me, format, count };
      if (format === "dates") {
        if (!startI.value || !endI.value) { err.textContent = "Pick a first and last day."; return; }
        const s = dayOf(startI.value), en = dayOf(endI.value);
        const max = new Date(s.getFullYear() + 1, s.getMonth(), s.getDate());
        if (en < s) { err.textContent = "The last day has to come after the first day. That's how time works."; return; }
        if (en > max) { err.textContent = "Keep it to a year or less."; return; }
        out.starts_at = s.toISOString();
        out.ends_at = new Date(en.getFullYear(), en.getMonth(), en.getDate(), 23, 59, 59, 999).toISOString();
      }
      close(out);
    };
    wrap.onclick = e => { if (e.target === wrap) close(null); };
    wrap.append(panel);
    document.body.append(wrap);
    setTimeout(() => nameI.focus({ preventScroll: true }), 50);
  });
}

async function loadSeasonV2(box, season, acct) {
  const isOwner = !!acct && acct.id === season.owner_id;
  const sub = document.querySelector("h1 + p");
  const desk = crabbyDesk();
  desk.reserve([CRABBY_SEASON.v2owner, CRABBY_SEASON.v2member, CRABBY_SEASON.v2join, CRABBY_SEASON.guest]);
  const banner = el("div");
  const joinArea = el("div");
  const standings = el("ul", { className: "player-list" });
  const addArea = el("div");
  const moneyArea = el("div");
  const ownerArea = el("div");
  box.append(backBtn("/?seasons", "All seasons"), infoLink("How seasons work", () => showRulesModal("Seasons", ["seasons"])), desk,
    banner, inviteRow(season), joinArea, h3el("Standings"), standings, addArea, moneyArea, ownerArea);
  const seasonGone = watchSeasonGone(box, season);

  const diffCache = new Map();
  async function difficulties(ids) {
    const need = [...new Set(ids.filter(Boolean))].filter(id => !diffCache.has(id));
    if (need.length) {
      const { data: cs } = await db.from("courses").select("*").in("id", need);
      await Promise.all(need.map(async id => {
        const course = (cs || []).find(c => c.id === id) || null;
        const { data: samples } = await db.rpc("course_samples", { p_course: id });
        diffCache.set(id, { course, diff: resolveDifficulty(course, samples) });
      }));
    }
    return id => diffCache.get(id) || { course: null, diff: resolveDifficulty(null, null) };
  }
  const cardOf = (scores, playerId) => {
    const mine = scores.filter(x => x.player_id === playerId && x.strokes > 0);
    const strokes = Array.from({ length: 18 }, (_, i) => { const x = mine.find(s => s.hole === i + 1); return x ? x.strokes : null; });
    return strokes.some(x => x == null) ? null : strokes;
  };

  const open = new Set();
  let data = null, seq = 0;

  async function refresh() {
    const my = ++seq;
    if (await seasonGone()) return;
    await currentSeasonRow();
    const [{ data: members }, { data: entries }] = await Promise.all([
      db.from("season_members").select("*").eq("season_id", season.id).order("created_at"),
      db.from("season_entries").select("*").eq("season_id", season.id),
    ]);
    const ids = [...new Set((entries || []).map(e => e.round_id))];
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
        loadRoundRanks(ids),
      ]);
      [rounds, players, scores, results, picks, cpreds, cmulls, sbets, swads] = res.slice(0, 9).map(r => r.data || []);
    }
    const infoOf = await difficulties(rounds.map(r => r.course_id));
    if (my !== seq) return;
    const scored = (entries || []).map(e => {
      const round = rounds.find(r => r.id === e.round_id);
      const strokes = round && cardOf(scores, e.player_id);
      if (!strokes) return null;
      const info = infoOf(round.course_id);
      return { entry: e, user_id: e.user_id, round_id: e.round_id, date: round.created_at, round, strokes,
        pars: coursePars(info.course), hcpIndex: info.course && info.course.hcp_index, diff: info.diff, course: info.course };
    }).filter(Boolean);
    const counts = new Map();
    (entries || []).forEach(e => counts.set(e.user_id, (counts.get(e.user_id) || 0) + 1));
    data = {
      members: members || [], entries: entries || [], counts,
      rows: scoreSeason({ format: season.format, count: season.rounds_count, members: members || [], entries: scored }),
      status: seasonStatus(season, members || [], counts),
    };
    renderHeader();
    renderJoin();
    renderStandings();
    renderAdd();
    renderOwner();
    renderSeasonMoney(moneyArea, new Map(), data.members, rounds, players, scores, results, picks, cpreds, cmulls, sbets, swads);
  }

  async function currentSeasonRow() {
    const { data: s } = await db.from("seasons").select("*").eq("id", season.id).maybeSingle();
    if (s) Object.assign(season, s);
  }

  function renderHeader() {
    sub.textContent = seasonFormatLine(season) + " · " + SEASON_STATUS[data.status];
    banner.innerHTML = "";
    if (data.status !== "final") return;
    const winners = data.rows.filter(r => r.place === 0 && r.points > 0);
    banner.className = "season-banner";
    banner.textContent = winners.length
      ? "🏆 " + winners.map(r => r.member.name).join(" and ") + (winners.length > 1 ? " tie" : " wins") + " the season with " + fmt1(winners[0].points) + " points."
      : "Season's over. Nobody scored. Impressive, in a way.";
  }

  function renderJoin() {
    joinArea.innerHTML = "";
    const joined = !!acct && data.members.some(m => m.user_id === acct.id);
    desk.say(!acct ? CRABBY_SEASON.guest : isOwner ? CRABBY_SEASON.v2owner : joined ? CRABBY_SEASON.v2member : CRABBY_SEASON.v2join);
    if (!acct) { accountPrompt(joinArea, "Create an account or sign in to join this season."); return; }
    if (joined) return;
    const b = el("button", { textContent: "Join this season" });
    b.style.cssText = "width:100%;margin-top:10px";
    b.onclick = async () => {
      const vals = await ask("Join " + season.name, [{ label: "Your name", placeholder: "What the boys call you", max: 20, value: await accountName() }], "Next");
      if (!vals) return;
      const hcp = await askSeasonHandicap(null);
      if (hcp == null) return;
      const { error } = await db.from("season_members").insert({ season_id: season.id, name: vals[0], handicap: hcp });
      if (error) { toast("Error: " + error.message); return; }
      refresh();
    };
    joinArea.append(b);
  }

  function renderStandings() {
    standings.innerHTML = "";
    if (!data.rows.length) { standings.append(el("li", { textContent: "No one here yet." })); return; }
    const N = season.rounds_count;
    data.rows.forEach(row => {
      const n = row.rounds.length;
      const progress = season.format === "rounds" ? Math.min(n, N) + " of " + N + " rounds"
        : n ? "Best " + Math.min(n, N) + " of " + n + (n === 1 ? " round" : " rounds") : "No rounds yet";
      const bits = [progress, "Season HCP " + hcpText(row.h)];
      if (n) bits.push("best " + fmt1(row.best));
      const hh = row.h2h;
      if (hh.w + hh.l + hh.t) bits.push("Head-to-head: " + hh.w + "-" + hh.l + (hh.t ? "-" + hh.t : ""));
      const li = el("li", { className: "sv2-row" },
        el("div", {}, el("span", { textContent: (row.place + 1) + ". " + row.member.name }), el("span", { className: "detail", textContent: bits.join(" · ") })),
        el("span", { textContent: fmt1(row.points) + " pts" }));
      li.setAttribute("aria-expanded", String(open.has(row.member.user_id)));
      li.onclick = () => {
        if (open.has(row.member.user_id)) open.delete(row.member.user_id); else open.add(row.member.user_id);
        renderStandings();
      };
      if (open.has(row.member.user_id)) li.append(memberRounds(row));
      standings.append(li);
    });
  }

  function memberRounds(row) {
    const ul = el("ul", { className: "sv2-rounds" });
    ul.onclick = e => e.stopPropagation();
    if (!row.rounds.length) {
      ul.append(el("li", { className: "waiting", textContent: row.member.user_id === (acct && acct.id) ? "Nothing yet. Tap Add a round." : "Nothing yet." }));
      return ul;
    }
    row.rounds.slice().reverse().forEach(r => {
      const counts = row.counted.has(r);
      const title = el("span", { className: "link-btn", textContent: r.round.name, onclick: () => openRound(r.round.code) });
      title.style.padding = "0";
      const left = el("div", {}, title,
        el("span", { className: "detail", textContent: shortDate(r.date) + " · " + courseName(r.course) }),
        el("span", { className: "detail", textContent: "Gross " + r.gross + ", adjusted " + r.adjusted + ", rating " + fmt1(r.roundRating) }),
        diffBadge(r.diff));
      const nameOf = id => (data.members.find(m => m.user_id === id) || {}).name || "someone";
      const vs = [["Beat", r.beat], ["Lost to", r.lostTo], ["Tied", r.tied]]
        .filter(([, ids]) => ids.length).map(([word, ids]) => word + " " + ids.map(nameOf).join(", "));
      if (vs.length) left.append(el("span", { className: "detail", textContent: vs.join(" · ") }));
      const right = el("div", { className: "sv2-pts" }, el("b", { textContent: fmt1(r.points) + " pts" }));
      if (!counts) right.append(el("span", { className: "detail", textContent: "Doesn't count" }));
      if (acct && (r.user_id === acct.id || isOwner)) {
        right.append(el("button", { className: "link-btn", textContent: "Remove", onclick: async () => {
          const ok = await pickFrom("Take " + r.round.name + " out of the season?", [{ label: "Remove it", value: true }]);
          if (!ok) return;
          const { error } = await db.from("season_entries").delete().eq("id", r.entry.id);
          if (error) { toast("Error: " + error.message); return; }
          refresh();
        } }));
      }
      ul.append(el("li", { className: counts ? "" : "sv2-uncounted" }, left, right));
    });
    return ul;
  }

  function renderAdd() {
    addArea.innerHTML = "";
    if (!acct || !data.members.some(m => m.user_id === acct.id)) return;
    if (data.status === "final") return;
    const mine = data.counts.get(acct.id) || 0;
    if (season.format === "rounds" && mine >= season.rounds_count) {
      addArea.append(el("p", { className: "waiting", textContent: "You've got all " + season.rounds_count + " rounds in. Now we wait on everybody else." }));
      return;
    }
    const b = el("button", { textContent: "Add a round", onclick: addRound });
    b.style.cssText = "width:100%;margin-top:14px";
    addArea.append(b);
  }

  async function addRound() {
    const me = data.members.find(m => m.user_id === acct.id);
    const { data: mine } = await db.from("players").select("id, round_id").eq("user_id", acct.id);
    const taken = new Set(data.entries.filter(e => e.user_id === acct.id).map(e => e.round_id));
    const pidOf = new Map((mine || []).map(p => [p.round_id, p.id]));
    const ids = [...pidOf.keys()];
    const { data: rounds } = ids.length
      ? await db.from("rounds").select("*").in("id", ids).eq("status", "finished").order("created_at", { ascending: false })
      : { data: [] };
    const finished = rounds || [];
    const fresh = finished.filter(r => !taken.has(r.id));
    const inRange = fresh.filter(r => season.format === "rounds"
      ? new Date(r.created_at) > new Date(me.joined_at)
      : new Date(r.created_at) >= new Date(season.starts_at) && new Date(r.created_at) <= new Date(season.ends_at));
    const { data: scores } = inRange.length
      ? await db.from("scores").select("player_id, hole, strokes").in("player_id", inRange.map(r => pidOf.get(r.id)))
      : { data: [] };
    const ready = inRange.map(r => ({ round: r, strokes: cardOf(scores || [], pidOf.get(r.id)) })).filter(x => x.strokes);
    if (!ready.length) {
      toast(!finished.length ? "None of your rounds are finished yet. Go finish one."
        : !fresh.length ? "Every round you've finished is already in."
        : !inRange.length ? (season.format === "rounds" ? "Only rounds you start after joining count. Go play one."
          : "None of your finished rounds were played between " + shortDate(season.starts_at) + " and " + shortDate(season.ends_at) + ".")
        : "Your rounds are missing scores. You need all 18 holes.");
      return;
    }
    const infoOf = await difficulties(ready.map(x => x.round.course_id));
    const pick = await roundPicker(ready.map(x => ({ ...x, info: infoOf(x.round.course_id) })));
    if (!pick) return;
    const { error } = await db.from("season_entries").insert({ season_id: season.id, round_id: pick.round.id, player_id: pidOf.get(pick.round.id) });
    if (error) { toast("Error: " + error.message); return; }
    toast("Added. Let's see how you did.", true);
    open.add(acct.id);
    refresh();
  }

  function roundPicker(items) {
    return new Promise(resolve => {
      const wrap = el("div", { className: "modal" });
      const panel = el("div", { className: "modal-panel" });
      const list = el("ul", { className: "player-list" });
      const close = v => { wrap.remove(); resolve(v); };
      items.forEach(x => {
        const gross = x.strokes.reduce((a, b) => a + b, 0);
        const li = el("li", {},
          el("div", {}, el("span", { textContent: x.round.name }),
            el("span", { className: "detail", textContent: shortDate(x.round.created_at) + " · " + courseName(x.info.course) + " · shot " + gross })),
          diffBadge(x.info.diff));
        li.style.cssText = "cursor:pointer;align-items:center;gap:8px";
        li.onclick = () => close(x);
        list.append(li);
      });
      const cancel = el("button", { className: "btn-ghost", textContent: "Cancel", onclick: () => close(null) });
      cancel.style.cssText = "width:100%;margin-top:12px";
      wrap.onclick = e => { if (e.target === wrap) close(null); };
      panel.append(el("h2", { textContent: "Add a round" }), el("p", { className: "modal-note", textContent: "Your finished rounds that fit this season." }), list, cancel);
      wrap.append(panel);
      document.body.append(wrap);
    });
  }

  function renderOwner() {
    ownerArea.innerHTML = "";
    if (!isOwner) return;
    ownerArea.append(h3el("Commissioner tools"), el("p", { className: "waiting", textContent: "Starting handicaps. Fix anybody who fibbed." }));
    const ul = el("ul", { className: "player-list" });
    data.members.forEach(m => {
      ul.append(el("li", {},
        el("div", {}, el("span", { textContent: m.name + (m.user_id === acct.id ? " (you)" : "") }),
          el("span", { className: "detail", textContent: m.handicap != null ? "Handicap " + hcpText(Number(m.handicap)) : "No handicap yet" })),
        el("button", { className: "link-btn", textContent: "Edit", onclick: async () => {
          const h = await askSeasonHandicap(m.name, m.handicap);
          if (h == null) return;
          const { error } = await db.from("season_members").update({ handicap: h }).eq("season_id", season.id).eq("user_id", m.user_id);
          if (error) { toast("Error: " + error.message); return; }
          refresh();
        } })));
    });
    ownerArea.append(ul);
    if (season.format === "rounds" && data.status !== "final") {
      const end = el("button", { className: "btn-ghost", textContent: "End season", onclick: async () => {
        const ok = await pickFrom("End the season now? Standings lock and nobody can add rounds.", [{ label: "End it", value: true }]);
        if (!ok) return;
        const { error } = await db.from("seasons").update({ ended_at: new Date().toISOString() }).eq("id", season.id);
        if (error) { toast("Error: " + error.message); return; }
        refresh();
      } });
      end.style.cssText = "width:100%;margin-top:14px";
      ownerArea.append(end);
    }
    ownerArea.append(deleteSeasonButton(season));
  }

  dropSeasonChannel();
  let timer = null;
  seasonChannel = db.channel("season-" + season.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "season_entries", filter: "season_id=eq." + season.id },
      () => { clearTimeout(timer); timer = setTimeout(refresh, 300); })
    .subscribe();

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
  else if (sp.has("tournaments")) loadTournamentList();
  else if (sp.get("t")) loadTournament(sp.get("t"));
}

function showHomeView() {
  document.querySelectorAll(".season-box").forEach(b => b.remove());
  dropSeasonChannel();
  dropTournamentChannel();
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

function pickNames(title, note, options) {
  return new Promise(resolve => {
    const wrap = el("div", { className: "modal" });
    const panel = el("div", { className: "modal-panel" });
    panel.append(el("h2", { textContent: title }), el("p", { className: "modal-note", textContent: note }));
    const row = el("div", { className: "chip-row" });
    const chosen = new Set(options.filter(o => o.checked).map(o => o.key));
    options.forEach(o => {
      const b = el("button", { type: "button", textContent: o.label + (o.disabled ? " (claimed)" : "") });
      b.disabled = !!o.disabled;
      b.classList.toggle("selected", chosen.has(o.key));
      b.onclick = () => {
        if (chosen.has(o.key)) chosen.delete(o.key); else chosen.add(o.key);
        b.classList.toggle("selected", chosen.has(o.key));
      };
      row.append(b);
    });
    const close = (val) => { wrap.remove(); resolve(val); };
    const done = el("button", { type: "button", textContent: "That's me" });
    done.style.cssText = "width:100%;margin-top:14px";
    done.onclick = () => close([...chosen]);
    const skip = el("button", { type: "button", className: "link-btn", textContent: "None of these are me" });
    skip.style.marginTop = "10px";
    skip.onclick = () => close([]);
    panel.append(row, done, skip);
    wrap.append(panel);
    document.body.append(wrap);
  });
}
