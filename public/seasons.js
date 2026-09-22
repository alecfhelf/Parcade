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
  document.body.classList.add("in-round");
  document.querySelector("h1").textContent = title;
  document.querySelector("h1 + p").textContent = subtitle;
  const box = el("div", { className: "lobby" });
  box.style.cssText = "margin-top:16px;width:100%;max-width:360px";
  $("status").before(box);
  return box;
}

const backBtn = (href, text) => el("button", { className: "link-btn", textContent: text, onclick: () => (location.href = href) });

async function currentAccount() {
  const { data: { session } } = await db.auth.getSession();
  const u = session && session.user;
  return u && !u.is_anonymous ? u : null;
}

function accountPrompt(box, msg) {
  box.append(
    el("p", { className: "waiting", textContent: msg }),
    el("button", { textContent: "Create account", onclick: async () => { await createAccount(); location.reload(); } }),
    el("button", { className: "btn-ghost", textContent: "Sign in", onclick: async () => { await signIn(); location.reload(); } })
  );
}

async function loadSeasonList() {
  const box = pageShell("Seasons", "Keep score across the whole trip");
  box.append(backBtn("/", "Back to home"));
  await ensureUser();
  const acct = await currentAccount();
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
    li.onclick = () => (location.href = "/?s=" + m.seasons.code);
    list.append(li);
  });
}

async function startSeason() {
  const vals = await ask("Start a season", [
    { label: "Season name", placeholder: "Scottsdale 2026" },
    { label: "Your name", placeholder: "What the boys call you", max: 20 }
  ], "Start season");
  if (!vals) return;
  const { data: season, error } = await db.from("seasons").insert({ name: vals[0] }).select().single();
  if (error) { toast("Error: " + error.message); return; }
  const r = await db.from("season_members").insert({ season_id: season.id, name: vals[1] });
  if (r.error) { toast("Error: " + r.error.message); return; }
  location.href = "/?s=" + season.code;
}

async function joinSeasonByCode() {
  const vals = await ask("Join a season", [{ label: "Season code", placeholder: "AB12CD", max: 6, upper: true }], "Let's go");
  if (vals) location.href = "/?s=" + vals[0].toUpperCase();
}

function roundStandings(round, rp, rs, rr) {
  const played = rs.filter(x => x.strokes);
  const rows = rp.map(pl => {
    const mine = played.filter(x => x.player_id === pl.id);
    if (!mine.length) return null;
    if (round.mode === "stroke") {
      const total = mine.reduce((a, x) => a + x.strokes, 0);
      return { pl, v: -(total / mine.length) };
    }
    let pts = 0;
    mine.forEach(m => { pts += 1 + played.filter(o => o.hole === m.hole && o.strokes > m.strokes).length; });
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
  const roundsList = el("ul", { className: "player-list" });
  const addArea = el("div");
  box.append(backBtn("/?seasons", "All seasons"), linkRow, joinArea,
    h3el("Standings"), standings, h3el("Rounds"), roundsList, addArea);

  async function refresh() {
    const [{ data: members }, { data: sr }] = await Promise.all([
      db.from("season_members").select("*").eq("season_id", season.id).order("created_at"),
      db.from("season_rounds").select("round_id").eq("season_id", season.id),
    ]);
    const ids = (sr || []).map(x => x.round_id);
    let rounds = [], players = [], scores = [], results = [];
    if (ids.length) {
      const res = await Promise.all([
        db.from("rounds").select("*").in("id", ids).order("created_at"),
        db.from("players").select("*").in("round_id", ids),
        db.from("scores").select("*").in("round_id", ids),
        db.from("challenge_results").select("*").in("round_id", ids),
      ]);
      [rounds, players, scores, results] = res.map(r => r.data || []);
    }
    renderJoin(members || []);
    renderStandings(members || [], rounds, players, scores, results);
    renderRounds(rounds);
    if (isOwner) renderAdd(ids);
  }

  function renderJoin(members) {
    joinArea.innerHTML = "";
    if (!acct) { accountPrompt(joinArea, "Create an account or sign in to join this season."); return; }
    if (members.some(m => m.user_id === acct.id)) return;
    const b = el("button", { textContent: "Join this season" });
    b.style.cssText = "width:100%;margin-top:10px";
    b.onclick = async () => {
      const vals = await ask("Join " + season.name, [{ label: "Your name", placeholder: "What the boys call you", max: 20 }], "I'm in");
      if (!vals) return;
      const { error } = await db.from("season_members").insert({ season_id: season.id, name: vals[0] });
      if (error) { toast("Error: " + error.message); return; }
      refresh();
    };
    joinArea.append(b);
  }

  function renderStandings(members, rounds, players, scores, results) {
    const memberById = new Map(members.map(m => [m.user_id, m]));
    const totals = new Map();
    members.forEach(m => totals.set("u:" + m.user_id, { name: m.name, pts: 0, wins: 0, rounds: 0 }));
    rounds.forEach(round => {
      const rows = roundStandings(round,
        players.filter(p => p.round_id === round.id),
        scores.filter(x => x.round_id === round.id),
        results.filter(x => x.round_id === round.id));
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

  function renderRounds(rounds) {
    roundsList.innerHTML = "";
    if (!rounds.length) {
      roundsList.append(el("li", { textContent: isOwner ? "No rounds yet. Add one below." : "No rounds added yet." }));
      return;
    }
    rounds.forEach(r => {
      const mode = r.mode === "stroke" ? "Stroke Play" : r.mode === "party" ? "Party Mode" : "Not started";
      const name = el("span", { textContent: r.name + " (" + mode + ")" });
      name.style.cursor = "pointer";
      name.onclick = () => (location.href = "/?r=" + r.code);
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
if (seasonBtn) seasonBtn.onclick = () => (location.href = "/?seasons");
const sp = new URLSearchParams(location.search);
if (sp.has("seasons")) loadSeasonList();
else if (sp.get("s")) loadSeason(sp.get("s"));
