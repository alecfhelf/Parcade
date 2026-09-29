// ---------- Tournaments ----------
// Pages: /?tournaments (list) and /?t=CODE (one tournament). Scoring and bracket logic live in tournament-core.js.
let tourneyChannel = null, tourneyPoll = null;
function dropTournamentChannel() {
  if (tourneyChannel) { db.removeChannel(tourneyChannel); tourneyChannel = null; }
  if (tourneyPoll) { clearInterval(tourneyPoll); tourneyPoll = null; }
}

const TN_STATUS = { setup: "Setting up", active: "In progress", finished: "Final" };
const TN_SCHEDULE = { one_day: "One day", over_time: "Over time" };
// Same tiles as round setup, in the same order. Unavailable ones stay on the grid, greyed out, with why.
const TN_GRID = ["party", "stroke", "skins", "match", "wolf", "bbb", "bestball", "vegas", "wad", "caddy"];

// { mode: one-line reason } for every mode that won't work with these settings
function tnModeOff(size, schedule) {
  const off = { caddy: "Caddies don't make a golf team.", wad: "Wad pots stay inside one group." };
  if (size !== 1) off.wolf = "Only with 1 player per team.";
  if (!(schedule === "over_time" && size <= 2)) off.bbb = "Over time, teams of 1 or 2 only.";
  return off;
}

// null if the mode works with these settings, otherwise why not
function tnModeProblem(mode, size, schedule) {
  if (!mode) return "Pick a game mode.";
  const why = tnModeOff(size, schedule)[mode];
  return why ? MODES[mode].name + " isn't available: " + why : null;
}

const tnEl = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function tnInviteRow(code) {
  const link = location.origin + "/?t=" + code;
  const input = el("input", { value: link, readOnly: true, onclick: () => input.select() });
  input.style.cssText = "flex:1;min-width:0;padding:12px;border-radius:10px;font-size:16px";
  const copy = el("button", { textContent: "Copy" });
  copy.style.cssText = "flex:0 0 112px;padding:12px 0;white-space:nowrap";
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(link); } catch (e) { input.select(); document.execCommand("copy"); }
    copy.textContent = "Copied!";
    setTimeout(() => (copy.textContent = "Copy"), 1500);
  };
  const row = el("div", {}, input, copy);
  row.style.cssText = "display:flex;gap:8px;margin-top:8px";
  return row;
}

// ---------- List ----------
async function loadTournamentList() {
  const box = pageShell("Tournaments", "Teams, a bracket, one champion");
  box.append(backBtn("/", "Back to home"), infoLink("How tournaments work", () => showRulesModal("Tournaments", ["tournaments"])));
  await ensureUser();
  const acct = await currentAccount();
  const desk = crabbyDesk();
  box.append(desk);
  crabbyTour(desk, acct ? CRABBY_TOURNEY.tour : CRABBY_TOURNEY.tourGuest);
  if (!acct) { accountPrompt(box, "Tournaments need an account so everybody knows who's who."); return; }

  const list = el("ul", { className: "player-list" });
  box.append(
    el("button", { textContent: "Start a tournament", onclick: startTournament }),
    el("button", { className: "btn-ghost", textContent: "Join with a code", onclick: joinTournamentByCode }),
    h3el("Your tournaments"),
    list
  );
  const { data: mem } = await db.from("tournament_members").select("tournament_id, tournaments(*)").eq("user_id", acct.id);
  const rows = (mem || []).map(m => m.tournaments).filter(Boolean).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!rows.length) { list.append(el("li", { textContent: "No tournaments yet. Start one and make it official." })); return; }
  rows.forEach(t => {
    const li = el("li", {},
      el("div", {}, el("span", { textContent: t.name }),
        el("span", { className: "detail", textContent: TN_STATUS[t.status] + " · " + t.team_count + " teams of " + t.team_size + " · " + (MODES[t.mode] || MODES.stroke).name })),
      el("span", { className: "link-btn", textContent: "Open" }));
    li.style.cursor = "pointer";
    li.onclick = () => navTo("/?t=" + t.code);
    list.append(li);
  });
}

async function joinTournamentByCode() {
  const vals = await ask("Join a tournament", [{ label: "Tournament code", placeholder: "AB12CD", max: 6, upper: true }], "Let's go");
  if (vals) navTo("/?t=" + vals[0].toUpperCase());
}

async function startTournament() {
  const form = await tournamentForm(null, await accountName());
  if (!form) return;
  const hcp = await askSeasonHandicap(null);
  if (hcp == null) return;
  const { data: t, error } = await db.from("tournaments").insert(form.row).select().single();
  if (error) { toast("Error: " + error.message); return; }
  const r = await db.from("tournament_members").insert({ tournament_id: t.id, name: form.me, hcp, usual_score: Math.round(72 + hcp) });
  if (r.error) { toast("Error: " + r.error.message); return; }
  navTo("/?t=" + t.code);
}

// ---------- Settings form (create and edit) ----------
function tournamentForm(t, myName) {
  return new Promise(resolve => {
    const s = t ? { ...t, buy_in: Number(t.buy_in) || 0, payouts: t.payouts ? t.payouts.map(Number) : null } : {
      name: "", mode: "stroke", handicap: true, team_size: 2, team_count: 8, schedule: "over_time", holes_per_match: 18,
      third_place: false, tiebreak: "card_off", buy_in: 0, payouts: null, course_id: null,
    };
    let course = null;
    const wrap = el("div", { className: "modal" });
    const panel = el("form", { className: "modal-panel" });
    const field = (label, input) => el("label", {}, el("span", { textContent: label }), input);
    const nameI = el("input", { placeholder: "The Crabby Cup", maxLength: 40, autocomplete: "off", value: s.name || "" });
    const meI = el("input", { placeholder: "What the boys call you", maxLength: 20, autocomplete: "off", value: myName || "" });

    const draws = [];
    const redraw = () => draws.forEach(f => f());
    const row = (label, hint, right) => {
      const h = el("small");
      const r = el("div", { className: "toggle-row" }, el("div", {}, el("span", { className: "field-label", textContent: label }), h), right);
      if (typeof hint === "function") draws.push(() => (h.textContent = hint())); else h.textContent = hint || "";
      return r;
    };
    const choice = (key, opts) => {
      const box = el("div", { className: "fmt-pick" });
      box.setAttribute("role", "radiogroup");
      opts.forEach(([v, text]) => {
        const b = el("button", { type: "button", className: "switch", textContent: text, onclick: () => { s[key] = v; redraw(); } });
        b.setAttribute("role", "radio");
        draws.push(() => { b.classList.toggle("on", s[key] === v); b.setAttribute("aria-checked", String(s[key] === v)); });
        box.append(b);
      });
      return box;
    };
    const stepper = (key, min, max, label) => {
      const val = el("b");
      const down = el("button", { type: "button", className: "mini", textContent: "−", onclick: () => { s[key] = Math.max(min, s[key] - 1); redraw(); } });
      const up = el("button", { type: "button", className: "mini", textContent: "+", onclick: () => { s[key] = Math.min(max, s[key] + 1); redraw(); } });
      down.setAttribute("aria-label", "Fewer " + label);
      up.setAttribute("aria-label", "More " + label);
      draws.push(() => { val.textContent = s[key]; down.disabled = s[key] <= min; up.disabled = s[key] >= max; });
      return el("div", { className: "stepper" }, down, val, up);
    };

    const picker = modeGrid({ modes: TN_GRID, selected: s.mode, off: tnModeOff(s.team_size, s.schedule), onPick: k => { s.mode = k; redraw(); } });
    let offKey = null;
    draws.push(() => {
      // A setting change can knock out the picked mode (Wolf, then 2 per team). Unpick it so they choose again.
      const off = tnModeOff(s.team_size, s.schedule);
      if (s.mode && off[s.mode]) { s.mode = null; picker.setPicked(null); }
      const key = Object.keys(off).sort().join();
      if (key !== offKey) { offKey = key; picker.setOff(off); }
    });

    const courseBtn = el("button", { type: "button", className: "btn-ghost" });
    courseBtn.style.cssText = "width:100%;margin-bottom:14px;padding:12px";
    courseBtn.onclick = async () => {
      const c = await tnCoursePicker();
      if (!c) return;
      course = c;
      s.course_id = c.id;
      redraw();
    };
    const clearCourse = el("button", { type: "button", className: "link-btn", textContent: "No course", onclick: () => { course = null; s.course_id = null; redraw(); } });
    clearCourse.style.cssText = "margin:-8px 0 12px";
    draws.push(() => {
      courseBtn.textContent = s.course_id ? "Course: " + (course ? courseName(course) : "picked") + " (change)" : "Pick a course" + (s.schedule === "one_day" ? " (required)" : " (optional)");
      clearCourse.style.display = s.course_id ? "" : "none";
    });
    if (s.course_id) db.from("courses").select("*").eq("id", s.course_id).maybeSingle().then(({ data }) => { course = data; redraw(); });

    // Money: the same buy-in pot as a round's Play for money. Everyone on a team pays; places pay whole teams.
    let money = s.buy_in > 0;
    const pot = potSetup({ split: [50, 30, 20], auto: true, buyIn: s.buy_in || null, payouts: s.payouts,
      payers: () => s.team_count * s.team_size,
      payerText: n => s.team_count + " teams of " + s.team_size + ", " + n + " players",
      teamSize: () => s.team_size });
    const moneySw = el("button", { type: "button", className: "switch", onclick: () => { money = !money; redraw(); } });
    moneySw.setAttribute("role", "switch");
    moneySw.setAttribute("aria-label", "Play for money");
    const moneyOpts = el("div", {}, pot.el,
      el("p", { className: "cp-note", textContent: "Each place's money is split evenly between that team's players." }));
    const thirdNote = el("p", { className: "cp-note" });
    moneyOpts.append(thirdNote);
    moneyOpts.style.marginTop = "12px";
    const moneyBox = el("div", { className: "money-box" }, el("div", { className: "toggle-row" },
      el("div", {}, el("span", { className: "field-label", textContent: "Play for money" }), el("small", { textContent: "Parcade keeps track. You settle up yourselves." })),
      moneySw), moneyOpts);
    draws.push(() => {
      moneySw.textContent = money ? "On" : "Off";
      moneySw.classList.toggle("on", money);
      moneySw.setAttribute("aria-checked", String(money));
      moneyOpts.style.display = money ? "" : "none";
      thirdNote.textContent = "No 3rd-place match, so the two semifinal losers split 3rd.";
      thirdNote.style.display = s.third_place ? "none" : "";
      pot.sync();
    });

    const holesRow = row("Holes per match", "Each match is its own round.", choice("holes_per_match", [[9, "9"], [18, "18"]]));
    const tieRow = row("Ties", () => (s.tiebreak === "playoff" ? "Play a hole. You enter the winner." : "Hardest hole decides it, then the next."),
      choice("tiebreak", [["card_off", "Card-off"], ["playoff", "Playoff"]]));
    draws.push(() => {
      holesRow.style.display = s.schedule === "over_time" ? "" : "none";
      tieRow.style.display = s.schedule === "over_time" ? "" : "none";
      if (s.schedule === "one_day") s.tiebreak = "card_off";
    });

    const err = el("p", { className: "modal-error" });
    err.setAttribute("role", "alert");
    const close = v => { wrap.remove(); resolve(v); };
    const cancel = el("button", { type: "button", className: "btn-ghost", textContent: "Cancel", onclick: () => close(null) });
    const ok = el("button", { type: "submit", textContent: t ? "Save" : "Next" });
    panel.append(el("h2", { textContent: t ? "Tournament settings" : "Start a tournament" }), field("Tournament name", nameI));
    if (!t) panel.append(field("Your name", meI));
    panel.append(
      el("span", { className: "field-label", textContent: "Game mode" }), picker.el,
      row("Teams", () => s.team_count + " teams, " + T_roundsText(s.team_count), stepper("team_count", 4, 64, "teams")),
      row("Players per team", () => (s.team_size === 1 ? "Every player for themselves" : s.team_size + " players a team"), stepper("team_size", 1, 4, "players")),
      row("Schedule", () => (s.schedule === "one_day" ? "One 18. Each bracket round is a chunk of holes." : "Every match is its own round."),
        choice("schedule", [["one_day", "One day"], ["over_time", "Over time"]])),
      holesRow,
      courseBtn, clearCourse,
      row("Handicaps", "Strokes from the best player in the whole tournament", choice("handicap", [[true, "On"], [false, "Off"]])),
      row("3rd-place match", () => (s.third_place ? "Semifinal losers play for 3rd" : "Semifinal losers split 3rd"), choice("third_place", [[true, "On"], [false, "Off"]])),
      tieRow,
      moneyBox,
      err, el("div", { className: "modal-actions" }, cancel, ok));
    redraw();

    panel.onsubmit = e => {
      e.preventDefault();
      err.textContent = "";
      const name = nameI.value.trim(), me = meI.value.trim();
      if (!name) { nameI.focus(); return; }
      if (!t && !me) { meI.focus(); return; }
      const prob = tnModeProblem(s.mode, s.team_size, s.schedule);
      if (prob) { err.textContent = prob; return; }
      if (s.schedule === "one_day" && !s.course_id) { err.textContent = "The one-day format needs a course, so everyone plays the same holes."; return; }
      if (money && pot.problem()) { err.textContent = pot.problem(); return; }
      close({ me, row: {
        name, mode: s.mode, handicap: s.handicap, team_size: s.team_size, team_count: s.team_count, schedule: s.schedule,
        holes_per_match: s.holes_per_match, third_place: s.third_place, tiebreak: s.schedule === "one_day" ? "card_off" : s.tiebreak,
        buy_in: money ? pot.buyIn() : 0, payouts: money ? pot.payouts() : null, course_id: s.course_id,
      } });
    };
    wrap.onclick = e => { if (e.target === wrap) close(null); };
    wrap.append(panel);
    document.body.append(wrap);
    picker.fit();
    setTimeout(() => nameI.focus({ preventScroll: true }), 50);
  });
}

function T_roundsText(n) {
  const r = bracketRounds(n), size = 1 << r;
  return r + " rounds" + (size > n ? ", " + (size - n) + (size - n === 1 ? " bye" : " byes") : "");
}

// ---------- Course picker (same sources as the round lobby) ----------
async function tnSaveCourse(row) {
  const { data, error } = await db.from("courses").insert(row).select().single();
  if (error) { toast(error.message); return null; }
  return data;
}

async function tnApiCourse(c) {
  toast("Grabbing the scorecard...", true);
  let d = null;
  try {
    const r = await fetch("/.netlify/functions/courses?id=" + encodeURIComponent(c.id));
    if (r.ok) d = await r.json();
  } catch (e) {}
  const location = [(c.city || "").trim(), c.state].filter(Boolean).join(", ") || null;
  const card = d && Array.isArray(d.scorecard) ? d.scorecard.slice().sort((a, b) => a.hole - b.hole) : [];
  const pars = card.length === 18 ? card.map(h => Number(h.par)) : null;
  if (!pars || pars.some(p => !(p >= 3 && p <= 6))) {
    toast("No scorecard for that one yet. Punch in the pars.");
    const m = await parsModal(c.name);
    return m ? tnSaveCourse({ ...m, location: m.location || location }) : null;
  }
  const hcps = card.map(h => Number(h.handicap ?? h.hcp));
  const hcp_index = hcps.every(n => n >= 1 && n <= 18) && new Set(hcps).size === 18 ? hcps : null;
  let tee = null;
  if (d.tees && d.tees.length) {
    tee = await teeModal(d.name || c.name, d.tees);
    if (tee === undefined) return null;
  }
  const tee_name = tee ? teeLabel(tee) : null;
  const { data: have } = await db.from("courses").select("*").eq("source", "api").eq("external_id", c.id);
  const same = (have || []).filter(x => (x.tee_name || null) === tee_name && x.pars.join() === pars.join());
  const match = same.find(x => x.hcp_index) || (hcp_index ? null : same[0]);
  if (match) return match;
  return tnSaveCourse({ name: d.name || c.name, location, tee_name, pars, hcp_index, ...teeDifficulty(tee, d.tees), source: "api", external_id: c.id });
}

function tnCoursePicker() {
  return new Promise(resolve => {
    const wrap = el("div", { className: "modal" });
    const panel = el("div", { className: "modal-panel" });
    const search = el("input", { type: "search", placeholder: "Search courses", className: "course-search", autocomplete: "off" });
    const results = el("ul", { className: "player-list course-results" });
    const close = v => { wrap.remove(); resolve(v); };
    const busy = async fn => { wrap.style.visibility = "hidden"; const c = await fn(); wrap.style.visibility = ""; if (c) close(c); };
    const manual = el("button", { className: "btn-ghost", textContent: "Enter the pars myself",
      onclick: () => busy(async () => { const m = await parsModal(search.value.trim()); return m ? tnSaveCourse(m) : null; }) });
    manual.style.cssText = "width:100%;margin-top:10px";
    const cancel = el("button", { className: "link-btn", textContent: "Cancel", onclick: () => close(null) });
    cancel.style.marginTop = "10px";
    const note = text => el("li", { className: "waiting", textContent: text });
    const rowFor = (title, detail, onclick) => {
      const li = el("li", {}, el("div", {}, el("span", { textContent: title }), el("span", { className: "detail", textContent: detail })));
      li.style.cursor = "pointer";
      li.onclick = onclick;
      return li;
    };
    let timer = null, seq = 0;
    search.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = search.value.trim(), my = ++seq;
        results.innerHTML = "";
        if (q.length < 3) return;
        results.append(note("Searching..."));
        const { data: { session } } = await db.auth.getSession();
        const uid = session && session.user && session.user.id;
        const [own, ext] = await Promise.all([
          db.from("courses").select("*").neq("source", "api").eq("created_by", uid).ilike("name", "%" + q.replace(/[%_\\]/g, "") + "%").limit(5),
          fetch("/.netlify/functions/courses?q=" + encodeURIComponent(q)).then(r => (r.ok ? r.json() : {})).then(j => j.courses || []).catch(() => []),
        ]);
        if (my !== seq) return;
        results.innerHTML = "";
        const par = c => c.pars.reduce((a, b) => a + b, 0);
        (own.data || []).forEach(c => results.append(rowFor(courseName(c), [c.location, "Par " + par(c)].filter(Boolean).join(", "), () => close(c))));
        ext.forEach(c => results.append(rowFor(c.name, [[(c.city || "").trim(), c.state].filter(Boolean).join(", "), c.par ? "Par " + c.par : ""].filter(Boolean).join(", "),
          () => busy(() => tnApiCourse(c)))));
        if (!(own.data || []).length && !ext.length) results.append(note("No courses found. Enter the pars yourself below."));
        if (ext.length) results.append(el("li", { className: "course-attrib", textContent: "Course data © OpenStreetMap contributors via OpenGolfAPI" }));
      }, 300);
    };
    wrap.onclick = e => { if (e.target === wrap) close(null); };
    panel.append(el("h2", { textContent: "Pick a course" }), search, results, manual, cancel);
    wrap.append(panel);
    document.body.append(wrap);
    setTimeout(() => search.focus({ preventScroll: true }), 50);
  });
}

// ---------- One tournament ----------
async function loadTournament(code) {
  const box = pageShell("Tournament", "");
  await ensureUser();
  const acct = await currentAccount();
  const { data: first } = await db.from("tournaments").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!first) return tournamentPreview(box, code, acct);
  const t = first;
  const isOwner = !!acct && acct.id === t.owner_id;
  const sub = document.querySelector("h1 + p");

  const desk = crabbyDesk();
  desk.reserve(Object.values(CRABBY_TOURNEY).filter(v => typeof v === "string"));
  const banner = el("div");
  const summary = el("div", { className: "tb-summary" });
  const invite = el("div");
  const goArea = el("div");
  const resultsArea = el("div");
  const bracketArea = el("div");
  const teamsArea = el("div");
  const membersArea = el("div");
  const ownerArea = el("div");
  box.append(backBtn("/?tournaments", "All tournaments"), infoLink("How tournaments work", () => showRulesModal("Tournaments", ["tournaments"])),
    desk, banner, summary, invite, goArea, resultsArea, bracketArea, teamsArea, membersArea, ownerArea);

  let S = null, seq = 0, swapPick = null, subKey = null, gone = false, courseCache = null;

  async function refresh() {
    if (gone || !box.isConnected) return;
    const my = ++seq;
    const [tr, mr, tmr, mtr, rr] = await Promise.all([
      db.from("tournaments").select("*").eq("id", t.id).maybeSingle(),
      db.from("tournament_members").select("*").eq("tournament_id", t.id).order("joined_at"),
      db.from("tournament_teams").select("*").eq("tournament_id", t.id).order("position"),
      db.from("tournament_matches").select("*").eq("tournament_id", t.id),
      db.from("rounds").select("*").eq("tournament_id", t.id),
    ]);
    if (my !== seq || !box.isConnected) return;
    if (!tr.error && !tr.data) { gone = true; dropTournamentChannel(); showDeleted(box, "tournament"); return; }
    if (tr.data) Object.assign(t, tr.data);
    const rounds = rr.data || [];
    const ids = rounds.map(r => r.id);
    let players = [], scores = [], awards = [];
    if (ids.length) {
      const res = await Promise.all([
        db.from("players").select("*").in("round_id", ids),
        db.from("scores").select("*").in("round_id", ids),
        db.from("challenge_results").select("*").in("round_id", ids),
      ]);
      [players, scores, awards] = res.map(r => r.data || []);
    }
    if (t.course_id && (!courseCache || courseCache.id !== t.course_id)) {
      const { data: c } = await db.from("courses").select("*").eq("id", t.course_id).maybeSingle();
      courseCache = c || null;
    }
    if (my !== seq || !box.isConnected) return;
    S = compute({ members: mr.data || [], teams: tmr.data || [], matches: mtr.data || [], rounds, players, scores, awards,
      course: t.course_id ? courseCache : null });
    subscribe(ids);
    render();
  }

  // Everything derived from the raw rows: who's on which team, every match result, placements and money
  function compute(raw) {
    const { members, teams, matches, rounds, players, scores, awards, course } = raw;
    const R = bracketRounds(t.team_count);
    const onTeam = members.filter(m => m.team_id);
    const memberOf = new Map(members.map(m => [m.user_id, m]));
    const teamOf = new Map(teams.map(x => [x.id, x]));
    const roster = id => onTeam.filter(m => m.team_id === id).sort((a, b) => String(a.assigned_at).localeCompare(String(b.assigned_at)));
    const teamHcp = id => roster(id).reduce((a, m) => a + hcpOf(m), 0);
    const usuals = onTeam.map(usualOf).filter(v => v != null);
    const base = t.handicap && usuals.length ? Math.min(...usuals) : null;
    const ranks = course && Array.isArray(course.hcp_index) && course.hcp_index.length === 18 ? course.hcp_index : null;
    const strokesFor = (uid, h) => (t.handicap && memberOf.get(uid) ? strokesOnHole(strokesTotal(usualOf(memberOf.get(uid)), base), h, ranks) : 0);
    const playerById = new Map(players.map(p => [p.id, p]));
    const gross = new Map();
    scores.forEach(x => {
      const p = playerById.get(x.player_id);
      if (p && p.user_id && x.strokes > 0) gross.set(p.round_id + "|" + p.user_id + "|" + x.hole, x.strokes);
    });
    const teamRound = new Map(rounds.filter(r => r.tournament_team_id).map(r => [r.tournament_team_id, r]));
    const roundById = new Map(rounds.map(r => [r.id, r]));

    // Seeds: stored ones once started (or for random / manual); live from team handicaps while setting up by handicap
    let seedOf;
    if (t.status === "setup" && t.seeding === "handicap") seedOf = seedTeams(teams.map(x => ({ id: x.id, hcp: teamHcp(x.id) })), "handicap");
    else seedOf = seedTeams(teams.map(x => ({ id: x.id, hcp: teamHcp(x.id), seed: x.seed })), "manual");

    const holesFor = m => matchHoles(t, R, m.round_no, m.is_third_place);
    const resultFor = (m, a, b) => {
      const holes = holesFor(m);
      const ua = roster(a).map(x => x.user_id), ub = roster(b).map(x => x.user_id);
      const rid = uid => {
        if (t.schedule === "one_day") { const r = teamRound.get((memberOf.get(uid) || {}).team_id); return r ? r.id : null; }
        return m.round_id;
      };
      const mAwards = t.schedule === "over_time" && m.round_id
        ? awards.filter(x => x.round_id === m.round_id).map(x => ({ ...x, winner_id: (playerById.get(x.winner_id) || {}).user_id })) : [];
      return matchResult({
        mode: t.mode, holes, teamA: ua, teamB: ub,
        gross: (uid, h) => { const r = rid(uid); return r ? (gross.get(r + "|" + uid + "|" + h) ?? null) : null; },
        strokes: strokesFor, awards: mAwards, challenges: t.schedule === "over_time", ranks,
        hcpA: teamHcp(a), hcpB: teamHcp(b), seedA: seedOf.get(a), seedB: seedOf.get(b), tiebreak: t.tiebreak,
      });
    };

    let bracket = matches;
    if (t.status === "setup") {
      // Preview from the current seeds
      const bySeed = new Map([...seedOf].map(([id, s]) => [s, id]));
      bracket = buildBracket(t.team_count).map(x => ({ id: "p1-" + x.slot, round_no: 1, slot: x.slot, team_a: bySeed.get(x.a) || null, team_b: x.b ? bySeed.get(x.b) || null : null, preview: true }));
      for (let r = 2; r <= R; r++) for (let sl = 0; sl < (1 << (R - r)); sl++) bracket.push({ id: "p" + r + "-" + sl, round_no: r, slot: sl, preview: true });
      if (t.third_place) bracket.push({ id: "p3rd", round_no: R, slot: 0, is_third_place: true, preview: true });
    }
    const D = deriveBracket(R, bracket, t.status === "setup" ? () => null : resultFor);
    const place = t.status === "setup" ? { first: null, second: null, third: [] } : placements(R, bracket, D);
    const money = place.first && Number(t.buy_in) > 0
      ? tournamentPayouts({ teams: teams.map(x => ({ id: x.id, members: roster(x.id).map(m => m.user_id) })), buyIn: t.buy_in, payouts: t.payouts, place })
      : null;
    const me = acct ? memberOf.get(acct.id) : null;
    return { ...raw, R, onTeam, memberOf, teamOf, roster, teamHcp, base, ranks, strokesFor, gross, teamRound, roundById, seedOf, holesFor,
      bracket, D, place, money, me, myTeam: me && me.team_id };
  }

  function subscribe(roundIds) {
    const key = roundIds.slice().sort().join(",");
    if (tourneyChannel && key === subKey) return;
    dropTournamentChannel();
    subKey = key;
    let timer = null;
    const bump = () => { clearTimeout(timer); timer = setTimeout(refresh, 400); };
    const live = { event: "*", schema: "public" };
    let ch = db.channel("tourney-" + t.id)
      .on("postgres_changes", { ...live, table: "tournaments", filter: "id=eq." + t.id }, bump);
    ["tournament_members", "tournament_teams", "tournament_matches", "rounds"].forEach(tbl => {
      ch = ch.on("postgres_changes", { ...live, table: tbl, filter: "tournament_id=eq." + t.id }, bump);
    });
    // Realtime "in" filters top out at 100 values; the poll below covers anything past that
    if (roundIds.length) {
      const list = roundIds.slice(0, 100).join(",");
      ch = ch.on("postgres_changes", { ...live, table: "scores", filter: "round_id=in.(" + list + ")" }, bump)
        .on("postgres_changes", { ...live, table: "challenge_results", filter: "round_id=in.(" + list + ")" }, bump);
    }
    tourneyChannel = ch.subscribe();
    tourneyPoll = setInterval(() => { if (!document.hidden && box.isConnected) refresh(); }, 20000);
  }

  const teamName = id => (id && S.teamOf.get(id) ? S.teamOf.get(id).name : "TBD");
  const teamColor = id => (id && S.teamOf.get(id) ? S.teamOf.get(id).color : null);
  const holesText = holes => (holes.length === 18 ? "18 holes" : t.schedule === "over_time" ? holes.length + " holes" : "Holes " + holes[0] + "-" + holes[holes.length - 1]);
  const unit = r => {
    const m = t.mode === "vegas" && t.team_size === 1 || t.mode === "wolf" ? "stroke" : t.mode;
    return { party: "pts", bbb: "pts", vegas: "pts", skins: "skins", match: "holes won" }[m] || (t.handicap ? "net" : "strokes");
  };
  const canStart = d => t.status === "active" && t.schedule === "over_time" && d.teamA && d.teamB && !d.match.round_id && d.status === "ready"
    && (isOwner || [d.teamA, d.teamB].some(id => S.roster(id).some(m => m.user_id === (acct && acct.id) && m.is_captain)));
  const started = d => (t.schedule === "one_day"
    ? [d.teamA, d.teamB].some(id => { const r = id && S.teamRound.get(id); return r && S.scores.some(x => x.round_id === r.id && x.strokes > 0); })
    : !!d.match.round_id) || !!d.match.override_winner;

  function render() {
    renderHeader();
    renderGo();
    renderResults();
    renderBracket();
    renderTeams();
    renderMembers();
    renderOwner();
  }

  function renderHeader() {
    document.querySelector("h1").textContent = t.name;
    sub.textContent = TN_STATUS[t.status] + " · Code " + t.code;
    banner.innerHTML = "";
    banner.className = "";
    if (S.place.first) {
      banner.className = "season-banner";
      banner.textContent = "🏆 " + teamName(S.place.first) + " wins " + t.name + ".";
    }
    const bits = [
      ["Game", MODES[t.mode].name],
      ["Teams", t.team_count + " of " + t.team_size + " (" + T_roundsText(t.team_count) + ")"],
      ["Schedule", TN_SCHEDULE[t.schedule] + (t.schedule === "over_time" ? ", " + t.holes_per_match + "-hole matches" : "")],
      ["Course", S.course ? courseName(S.course) : "Any"],
      ["Handicaps", t.handicap ? "On" : "Off"],
      ["Ties", t.tiebreak === "playoff" ? "Playoff hole" : "Card-off"],
      ["Money", Number(t.buy_in) > 0 && t.payouts ? moneyFmt(t.buy_in) + " each, " + moneyFmt(t.buy_in * t.team_count * t.team_size) + " pot. Pays " +
        t.payouts.map((p, i) => ["1st", "2nd", "3rd"][i] + " " + moneyFmt(p) + (t.team_size > 1 ? " (" + moneyEach(p, t.team_size) + " each)" : "")).join(", ") : "Just bragging rights"],
    ];
    if (t.third_place) bits.splice(6, 0, ["3rd place", "Played for"]);
    summary.innerHTML = "";
    bits.forEach(([k, v], i) => { summary.append(el("b", { textContent: k + ": " }), v); if (i < bits.length - 1) summary.append(el("br")); });

    invite.innerHTML = "";
    if (t.status === "setup") invite.append(tnInviteRow(t.code));

    const out = S.myTeam && t.status === "active" && [...S.D.values()].some(d => d.loser === S.myTeam && !d.match.is_third_place)
      && ![...S.D.values()].some(d => d.match.is_third_place && [d.teamA, d.teamB].includes(S.myTeam) && d.status !== "final");
    desk.say(!acct ? CRABBY_TOURNEY.guest
      : t.status === "setup" ? (isOwner ? CRABBY_TOURNEY.setupOwner : S.me ? CRABBY_TOURNEY.setupMember : CRABBY_TOURNEY.join)
      : S.place.first || t.status === "finished" ? CRABBY_TOURNEY.finished
      : out ? CRABBY_TOURNEY.eliminated : CRABBY_TOURNEY.active);
  }

  // The match the viewer's team should be playing right now (over time)
  function myCurrentMatch() {
    if (!S.myTeam) return null;
    const mine = [...S.D.values()].filter(d => (d.teamA === S.myTeam || d.teamB === S.myTeam) && d.status !== "bye");
    return mine.filter(d => d.status !== "final").sort((a, b) => b.match.round_no - a.match.round_no)[0] || null;
  }

  function renderGo() {
    goArea.innerHTML = "";
    if (t.status !== "active" || !S.myTeam) return;
    if (t.schedule === "one_day") {
      const r = S.teamRound.get(S.myTeam);
      if (r) goArea.append(el("button", { className: "tb-go", textContent: "Go score: " + teamName(S.myTeam) + "'s round", onclick: () => openRound(r.code) }));
      return;
    }
    const d = myCurrentMatch();
    if (!d) return;
    const opp = teamName(d.teamA === S.myTeam ? d.teamB : d.teamA);
    const r = d.match.round_id && S.roundById.get(d.match.round_id);
    if (r) goArea.append(el("button", { className: "tb-go", textContent: "Go score vs " + opp, onclick: () => openRound(r.code) }));
    else if (canStart(d)) goArea.append(el("button", { className: "tb-go", textContent: "Start match vs " + opp, onclick: () => startMatch(d) }));
    else goArea.append(el("p", { className: "waiting", textContent: d.status === "waiting" ? "Your next opponent is still being decided." : "Waiting on a captain to start your match against " + opp + "." }));
  }

  async function startMatch(d) {
    const ok = await ask("Start the match?", [], "Tee it up", teamName(d.teamA) + " vs " + teamName(d.teamB) + ". This creates the round for both teams.");
    if (!ok) return;
    const { data: code, error } = await db.rpc("start_tournament_match", { p_match: d.match.id, p_team_a: d.teamA, p_team_b: d.teamB });
    if (error) { toast(error.message); refresh(); return; }
    openRound(code);
  }

  // ---------- Bracket ----------
  // The whole bracket at once: columns by round with connector lines. 16+ teams split into two halves that meet at
  // the championship in the middle. Cards are absolutely placed on one canvas, scaled for zoom, with one SVG for lines.
  const BK = { W: 184, H: 66, GAP: 12, COL: 34, HEAD: 44, PAD: 12 };
  const BK_MIN = 0.75; // Smallest starting zoom that still reads on a phone. Fit goes smaller if you ask for it.
  let bkZoom = 1, bkMode = "start", bkFocus = true, bkWidth = 0;
  const bkReset = () => { bkMode = "start"; bkFocus = true; };

  function bracketLayout() {
    const R = S.R, two = t.team_count >= 16;
    const { W, H, GAP, COL, HEAD, PAD } = BK;
    const cols = two ? 2 * R - 1 : R;
    const colX = c => PAD + c * (W + COL);
    const at = (r, sl) => S.bracket.find(m => m.round_no === r && m.slot === sl && !m.is_third_place);
    const pos = new Map();
    const heads = [];
    for (let r = 1; r <= R; r++) {
      const half = (1 << (R - r)) / 2;
      S.bracket.filter(m => m.round_no === r && !m.is_third_place).forEach(m => {
        let side = "L", col = r - 1, local = m.slot;
        if (two && r === R) side = "C";
        else if (two && m.slot >= half) { side = "R"; col = cols - r; local = m.slot - half; }
        let y;
        if (r === 1) y = HEAD + local * (H + GAP);
        else {
          const fs = [at(r - 1, 2 * m.slot), at(r - 1, 2 * m.slot + 1)].map(f => f && pos.get(f.id)).filter(Boolean);
          y = fs.length ? fs.reduce((a, f) => a + f.y, 0) / fs.length : HEAD;
        }
        pos.set(m.id, { x: colX(col), y, side, match: m });
      });
      heads.push({ r, col: r - 1 });
      if (two && r < R) heads.push({ r, col: cols - r });
    }
    const fin = at(R, 0), third = S.bracket.find(m => m.is_third_place);
    if (third && fin) {
      const f = pos.get(fin.id);
      pos.set(third.id, { x: f.x, y: f.y + H + 44, side: f.side, match: third });
    }
    let h = 0;
    pos.forEach(p => (h = Math.max(h, p.y + H)));
    return { pos, heads, at, two, w: colX(cols - 1) + W + PAD, h: h + PAD, third: third && pos.get(third.id) };
  }

  function renderBracket() {
    const old = bracketArea.querySelector(".bk-view");
    const keep = old ? { l: old.scrollLeft, t: old.scrollTop } : null;
    bracketArea.innerHTML = "";
    if (!S.teams.length) return;
    const R = S.R, { W, H, COL } = BK;
    bracketArea.append(h3el(t.status === "setup" ? "Bracket preview" : "Bracket"));
    if (t.status === "setup") bracketArea.append(el("p", { className: "waiting", textContent: "Seeded " +
      ({ handicap: "by team handicap", random: "randomly", manual: "by hand" })[t.seeding] + ". Matchups lock when the tournament starts." + (isOwner ? " Tap a match to swap teams." : "") }));
    const L = bracketLayout();
    const hasMine = r => S.myTeam && S.bracket.some(m => m.round_no === r && !m.is_third_place && [S.D.get(m.id).teamA, S.D.get(m.id).teamB].includes(S.myTeam));

    const canvas = el("div", { className: "bk-canvas" });
    canvas.style.width = L.w + "px";
    canvas.style.height = L.h + "px";

    // Connector lines, all in one SVG. My team's route glows.
    let paths = "";
    L.pos.forEach(p => {
      const m = p.match;
      if (m.round_no === 1 || m.is_third_place) return;
      [L.at(m.round_no - 1, 2 * m.slot), L.at(m.round_no - 1, 2 * m.slot + 1)].forEach(f => {
        const fp = f && L.pos.get(f.id);
        if (!fp) return;
        const fd = S.D.get(f.id);
        const cls = fd && fd.winner ? (fd.winner === S.myTeam ? "mine" : "done") : "";
        const y1 = fp.y + H / 2, y2 = p.y + H / 2;
        const d = fp.side === "R"
          ? "M" + fp.x + " " + y1 + "H" + (fp.x - COL / 2) + "V" + y2 + "H" + (p.x + W)
          : "M" + (fp.x + W) + " " + y1 + "H" + (fp.x + W + COL / 2) + "V" + y2 + "H" + p.x;
        paths += '<path class="' + cls + '" d="' + d + '"/>';
      });
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "bk-lines");
    svg.setAttribute("width", L.w);
    svg.setAttribute("height", L.h);
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = paths;
    canvas.append(svg);

    L.heads.forEach(({ r, col }) => {
      const hd = el("div", { className: "bk-head" + (hasMine(r) ? " mine" : "") },
        el("b", { textContent: roundName(R, r) }),
        el("span", { textContent: t.schedule === "one_day" ? holesText(S.holesFor({ round_no: r })) : "" }));
      hd.style.left = BK.PAD + col * (W + COL) + "px";
      hd.style.width = W + "px";
      canvas.append(hd);
    });
    if (L.third) {
      const lb = el("div", { className: "bk-head bk-third-head", textContent: "3rd place" + (t.schedule === "one_day" ? " · same holes as the final" : "") });
      lb.style.cssText = "left:" + L.third.x + "px;top:" + (L.third.y - 20) + "px;width:" + W + "px";
      canvas.append(lb);
    }
    L.pos.forEach(p => {
      const card = matchCard(S.D.get(p.match.id));
      card.style.left = p.x + "px";
      card.style.top = p.y + "px";
      canvas.append(card);
    });

    const sizer = el("div", { className: "bk-sizer" }, canvas);
    const view = el("div", { className: "bk-view" }, sizer);
    view.setAttribute("role", "region");
    view.setAttribute("aria-label", "Bracket. Scroll sideways to see every round.");
    const zoomText = el("span", { className: "bk-zoom" });
    const tool = (text, label, fn) => { const b = el("button", { type: "button", className: "mini", textContent: text, onclick: fn }); b.setAttribute("aria-label", label); return b; };
    const tools = el("div", { className: "bk-tools" });
    const target = myMatchPos(L);
    if (target) tools.append(tool("My team", "Scroll to my team", () => scrollToPos(view, target, true)));
    tools.append(zoomText,
      tool("−", "Zoom out", () => zoomBy(view, sizer, canvas, L, 0.8, zoomText)),
      tool("+", "Zoom in", () => zoomBy(view, sizer, canvas, L, 1.25, zoomText)),
      tool("Fit", "Fit the whole bracket", () => { bkMode = "fit"; applyZoom(view, sizer, canvas, L, fitZoom(view, L), zoomText); view.scrollLeft = 0; }));
    bracketArea.append(el("div", { className: "bk-wrap" }, tools, view));

    bkWidth = view.clientWidth;
    const z = bkMode === "manual" ? bkZoom : bkMode === "fit" ? fitZoom(view, L) : Math.min(1, Math.max(BK_MIN, fitZoom(view, L)));
    applyZoom(view, sizer, canvas, L, z, zoomText);
    if (bkFocus) {
      bkFocus = false;
      if (target) scrollToPos(view, target);
      else if (L.two) view.scrollLeft = (view.scrollWidth - view.clientWidth) / 2;
    } else if (keep) { view.scrollLeft = keep.l; view.scrollTop = keep.t; }
  }

  const fitZoom = (view, L) => Math.min(1, (view.clientWidth - 2) / L.w);

  function applyZoom(view, sizer, canvas, L, z, zoomText) {
    bkZoom = Math.max(0.1, Math.min(1.5, z));
    canvas.style.transform = "scale(" + bkZoom + ")";
    sizer.style.width = L.w * bkZoom + "px";
    sizer.style.height = L.h * bkZoom + "px";
    zoomText.textContent = Math.round(bkZoom * 100) + "%";
  }

  // Zoom around the middle of what's on screen
  function zoomBy(view, sizer, canvas, L, f, zoomText) {
    const cx = (view.scrollLeft + view.clientWidth / 2) / bkZoom, cy = (view.scrollTop + view.clientHeight / 2) / bkZoom;
    bkMode = "manual";
    applyZoom(view, sizer, canvas, L, bkZoom * f, zoomText);
    view.scrollLeft = cx * bkZoom - view.clientWidth / 2;
    view.scrollTop = cy * bkZoom - view.clientHeight / 2;
  }

  // Where the viewer's team is now: their live or next match, or the last one they played
  function myMatchPos(L) {
    if (!S.myTeam) return null;
    const cur = myCurrentMatch();
    if (cur && L.pos.get(cur.match.id)) return L.pos.get(cur.match.id);
    let best = null;
    L.pos.forEach(p => {
      const d = S.D.get(p.match.id);
      if ((d.teamA === S.myTeam || d.teamB === S.myTeam) && (!best || p.match.round_no > best.match.round_no)) best = p;
    });
    return best;
  }

  function scrollToPos(view, p, smooth) {
    const left = (p.x + BK.W / 2) * bkZoom - view.clientWidth / 2, top = (p.y + BK.H / 2) * bkZoom - view.clientHeight / 2;
    view.scrollTo({ left, top, behavior: smooth ? "smooth" : "auto" });
  }

  function matchCard(d) {
    const m = d.match, r = d.result;
    const mine = S.myTeam && (d.teamA === S.myTeam || d.teamB === S.myTeam);
    const card = el("button", { type: "button", className: "bk-card" + (mine ? " mine" : "") + (d.status === "bye" ? " bye" : "") +
      (d.status === "live" ? " live" : "") + (swapPick && [d.teamA, d.teamB].includes(swapPick) ? " picked" : ""), onclick: () => openMatch(d) });
    const line = (id, side) => {
      const rowEl = el("div", { className: "bk-row" });
      if (!id && d.status === "bye") { rowEl.classList.add("bye"); rowEl.append(el("span", { className: "bk-seed" }), el("span", { className: "bk-name", textContent: "Bye" })); return rowEl; }
      const dot = el("span", { className: "bk-dot" });
      if (id) dot.style.background = teamColor(id) || "var(--muted)";
      rowEl.append(el("span", { className: "bk-seed", textContent: id ? S.seedOf.get(id) || "" : "" }), dot, el("span", { className: "bk-name", textContent: id ? teamName(id) : "TBD" }));
      if (!id) rowEl.classList.add("tbd");
      if (r && r.holesDone) rowEl.append(el("span", { className: "bk-score", textContent: String(side === "a" ? r.a : r.b) }));
      if (d.winner && id) rowEl.classList.add(d.winner === id ? "win" : "lose");
      if (id && id === S.myTeam) rowEl.classList.add("me");
      return rowEl;
    };
    card.append(line(d.teamA, "a"), line(d.teamB, "b"));
    let status = "";
    if (d.status === "bye") status = "Moves on";
    else if (d.status === "final") status = d.overridden ? "Advanced" : r && r.tiebreak ? "Final (card-off)" : "Final";
    else if (d.status === "live") status = r && r.needsPlayoff ? "Tied: playoff" : r && r.holesDone ? "Live · thru " + r.holesDone + "/" + S.holesFor(m).length : "Live";
    else if (d.status === "ready") status = t.status === "setup" ? "" : "Not started";
    if (m.deadline && d.status !== "final" && d.status !== "bye") status += (status ? " · " : "") + (new Date(m.deadline) < new Date() ? "Past due" : "Due " + shortDate(m.deadline));
    card.append(el("div", { className: "bk-meta" + (d.status === "live" ? " tb-live" : ""), textContent: status }));
    const who = id => (id ? (S.seedOf.get(id) ? "seed " + S.seedOf.get(id) + " " : "") + teamName(id) + (r && r.holesDone ? " " + (id === d.teamA ? r.a : r.b) : "") : d.status === "bye" ? "a bye" : "TBD");
    card.setAttribute("aria-label", (m.is_third_place ? "3rd place" : roundName(S.R, m.round_no) + ", match " + (m.slot + 1)) + ": " + who(d.teamA) + " vs " + who(d.teamB) + (status ? ". " + status : ""));
    return card;
  }

  // ---------- Match detail ----------
  function openMatch(d) {
    const m = d.match, r = d.result;
    const holes = S.holesFor(m);
    const wrap = el("div", { className: "modal" });
    const panel = el("div", { className: "modal-panel rules-panel" });
    const close = () => wrap.remove();
    wrap.onclick = e => { if (e.target === wrap) close(); };
    const title = m.is_third_place ? "3rd place" : roundName(S.R, m.round_no) + ", match " + (m.slot + 1);
    panel.append(el("h2", { textContent: title }), el("p", { className: "modal-note", textContent: holesText(holes) + " · " + MODES[t.mode].name + (t.handicap ? " with handicaps" : "") }));

    let status;
    if (d.status === "bye") status = "Bye. " + teamName(d.teamA) + " moves on.";
    else if (d.status === "waiting") status = "Waiting on the matches before this one.";
    else if (t.status === "setup") status = "Matchup locks when the tournament starts.";
    else if (d.overridden) status = teamName(d.winner) + " advanced by the creator.";
    else if (d.status === "final") status = teamName(d.winner) + " wins, " + (d.winner === d.teamA ? r.a + " to " + r.b : r.b + " to " + r.a) + " " + unit(r) + ".";
    else if (r && r.needsPlayoff) status = "All square. Play a playoff hole, then the creator enters the winner.";
    else if (r && r.holesDone) status = "Live through " + r.holesDone + " of " + holes.length + " holes.";
    else status = t.schedule === "over_time" && !m.round_id ? "Not started. A captain in the match taps Start match." : "Not started yet.";
    panel.append(el("p", { textContent: status }));
    if (r && r.holesDone && d.teamB) panel.append(el("div", { className: "tb-score-line", textContent: teamName(d.teamA) + " " + r.a + " · " + teamName(d.teamB) + " " + r.b }));
    if (r && r.tiebreak && !d.overridden) panel.append(el("p", { className: "waiting", textContent: r.tiebreak.text }));
    if (m.deadline) panel.append(el("p", { className: "waiting", textContent: "Deadline: " + new Date(m.deadline).toLocaleDateString() }));

    [d.teamA, d.teamB].filter(Boolean).forEach(id => panel.append(teamCard(id, holes, m)));

    const actions = el("div");
    const addBtn = (text, fn, ghost) => {
      const b = el("button", { className: ghost ? "btn-ghost" : "", textContent: text, onclick: async () => { close(); await fn(); } });
      b.style.cssText = "width:100%;margin-top:10px";
      actions.append(b);
    };
    if (t.status === "active") {
      if (t.schedule === "one_day") {
        [d.teamA, d.teamB].forEach(id => { const rr = id && S.teamRound.get(id); if (rr) addBtn("Open " + teamName(id) + "'s round", () => openRound(rr.code), true); });
      } else if (m.round_id && S.roundById.get(m.round_id)) addBtn("Open the match round", () => openRound(S.roundById.get(m.round_id).code), true);
      if (canStart(d)) addBtn("Start match", () => startMatch(d));
      if (isOwner && d.teamA && d.teamB) addBtn(d.overridden ? "Change who advances" : "Advance a team", () => overrideMatch(d), true);
      if (isOwner && m.round_no === 1 && !m.is_third_place && !started(d)) addBtn("Swap a team", () => swapFrom(d), true);
    }
    if (t.status === "setup" && isOwner && m.round_no === 1 && !m.is_third_place) addBtn("Swap a team", () => swapFrom(d), true);
    const done = el("button", { textContent: "Close", onclick: close });
    done.style.cssText = "width:100%;margin-top:12px";
    panel.append(actions, done);
    wrap.append(panel);
    document.body.append(wrap);
  }

  function teamCard(id, holes, m) {
    const tm = S.teamOf.get(id);
    const roster = S.roster(id);
    const blk = el("div", { className: "tb-team" + (id === S.myTeam ? " mine" : "") });
    blk.style.setProperty("--c", tm.color || "var(--glow)");
    blk.append(el("div", { className: "tb-team-head" }, el("b", { textContent: tm.name }),
      el("span", { className: "detail", textContent: (S.seedOf.get(id) ? "Seed " + S.seedOf.get(id) + " · " : "") + "Team HCP " + hcpText(S.teamHcp(id)) })));
    const ul = el("ul", { className: "player-list" });
    roster.forEach(p => {
      const got = holes.reduce((a, h) => a + S.strokesFor(p.user_id, h), 0);
      ul.append(el("li", {}, el("span", { textContent: p.name + (p.is_captain ? " (captain)" : "") }),
        el("span", { className: "detail", textContent: "HCP " + hcpText(hcpOf(p)) + (t.handicap ? " · " + got + (got === 1 ? " stroke" : " strokes") : "") })));
    });
    blk.append(ul);
    // Scorecard for this match's holes only
    const rid = t.schedule === "one_day" ? (S.teamRound.get(id) || {}).id : m.round_id;
    if (!rid || !holes.some(h => roster.some(p => S.gross.has(rid + "|" + p.user_id + "|" + h)))) return blk;
    const table = tnEl("table", "sc-table tb-mc");
    const head = tnEl("tr");
    head.append(tnEl("th", null, ""));
    holes.forEach(h => head.append(tnEl("th", null, String(h))));
    head.append(tnEl("th", null, "Tot"));
    table.append(head);
    if (S.course && Array.isArray(S.course.pars)) {
      const tr = tnEl("tr", "sc-meta");
      tr.append(tnEl("td", null, "Par"));
      holes.forEach(h => tr.append(tnEl("td", null, String(S.course.pars[h - 1]))));
      tr.append(tnEl("td", "tot", String(holes.reduce((a, h) => a + S.course.pars[h - 1], 0))));
      table.append(tr);
    }
    roster.forEach(p => {
      const tr = tnEl("tr");
      tr.append(tnEl("td", null, p.name));
      let tot = 0;
      holes.forEach(h => {
        const g = S.gross.get(rid + "|" + p.user_id + "|" + h);
        if (g) tot += g;
        const td = tnEl("td", S.strokesFor(p.user_id, h) > 0 ? "stroke-dot" : null, g ? (g >= 11 ? "11+" : String(g)) : "-");
        tr.append(td);
      });
      tr.append(tnEl("td", "tot", tot ? String(tot) : "-"));
      table.append(tr);
    });
    const wrapT = tnEl("div", "sc-wrap");
    wrapT.append(table);
    blk.append(wrapT);
    if (t.handicap) blk.append(el("p", { className: "detail", textContent: "Gold dot = a handicap stroke on that hole." }));
    return blk;
  }

  async function overrideMatch(d) {
    const opts = [d.teamA, d.teamB].map(id => ({ label: teamName(id) + " advances", value: id, color: teamColor(id) }));
    if (d.match.override_winner) opts.push({ label: "Clear it, go back to the scores", value: "clear" });
    const pick = await pickFrom("Who moves on?", opts);
    if (!pick) return;
    const { error } = await db.rpc("set_match_override", { p_match: d.match.id, p_winner: pick === "clear" ? null : pick, p_team_a: d.teamA, p_team_b: d.teamB });
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function swapFrom(d) {
    const ids = [d.teamA, d.teamB].filter(Boolean);
    const first = ids.length === 1 ? ids[0] : await pickFrom("Swap which team?", ids.map(id => ({ label: teamName(id), value: id, color: teamColor(id) })));
    if (!first) return;
    const r1 = S.bracket.filter(m => m.round_no === 1 && !m.is_third_place);
    const others = [];
    r1.forEach(m => {
      const dm = S.D.get(m.id);
      if (m.id === d.match.id || (t.status === "active" && started(dm))) return;
      [dm.teamA, dm.teamB].filter(Boolean).forEach(id => others.push({ label: teamName(id) + " (match " + (m.slot + 1) + ")", value: id, color: teamColor(id) }));
    });
    if (!others.length) { toast("Every other first-round match already started."); return; }
    const second = await pickFrom("Swap " + teamName(first) + " with...", others);
    if (!second) return;
    if (t.status === "setup" && t.seeding === "handicap") await writeSeeds(S.seedOf);
    const { error } = await db.rpc("swap_tournament_teams", { p_t: t.id, p_team1: first, p_team2: second });
    if (error) { toast(error.message); return; }
    refresh();
  }

  // ---------- Results ----------
  function renderResults() {
    resultsArea.innerHTML = "";
    if (!S.place.first) return;
    resultsArea.append(h3el("Results"));
    const cols = [
      { ids: [S.place.second], i: 1 },
      { ids: [S.place.first], i: 0 },
      { ids: S.place.third, i: 2 },
    ];
    const podium = tnEl("div", "podium");
    cols.forEach(({ ids, i }) => {
      if (!ids.length || !ids[0]) return;
      const col = tnEl("div", "podium-col place-" + (i + 1));
      col.append(podiumFigure(teamColor(ids[0]), i), tnEl("div", "podium-name", ids.map(teamName).join(" & ")),
        tnEl("div", "podium-score", ids.flatMap(id => S.roster(id).map(p => p.name)).join(", ")), tnEl("div", "podium-block", ["1st", "2nd", "3rd"][i]));
      podium.append(col);
    });
    resultsArea.append(podium);
    if (!S.place.third.length) resultsArea.append(el("p", { className: "waiting", textContent: "3rd place is still being decided." }));
    if (!S.money) return;
    const nameOf = uid => (S.memberOf.get(uid) || {}).name || "Someone";
    resultsArea.append(h3el("💵 Payouts · " + moneyFmt(S.money.pot) + " pot"));
    const places = el("ul", { className: "player-list" });
    [[S.place.first], [S.place.second], S.place.third].forEach((ids, i) => {
      const amt = Number((t.payouts || [])[i] || 0);
      if (!amt) return;
      const who = ids.filter(Boolean);
      const split = who.length > 1 ? " (split " + who.length + " ways)" : "";
      places.append(el("li", {}, el("div", {}, el("span", { textContent: ["1st", "2nd", "3rd"][i] + ": " + (who.length ? who.map(teamName).join(" & ") : "Not decided yet") }),
        el("span", { className: "detail", textContent: t.team_size > 1 || who.length > 1 ? moneyEach(amt / Math.max(1, who.length), t.team_size) + " each player" + split : "" })),
        el("b", { textContent: moneyFmt(amt) })));
    });
    resultsArea.append(places, h3el("Everyone's net"));
    const ul = el("ul", { className: "player-list" });
    Object.entries(S.money.net).sort((a, b) => b[1].total - a[1].total).forEach(([uid, x]) => {
      ul.append(el("li", {}, el("div", {}, el("span", { textContent: nameOf(uid) }),
        el("span", { className: "detail", textContent: "Won " + moneyFmt(x.won) + ", paid " + moneyFmt(t.buy_in) })),
        el("span", { className: x.total > 0 ? "money-pos" : x.total < 0 ? "money-neg" : "", textContent: moneySigned(x.total) })));
    });
    resultsArea.append(ul, h3el("Who owes who"));
    const moves = tournamentSettle(S.money.net);
    const ul2 = el("ul", { className: "player-list" });
    if (!moves.length) ul2.append(el("li", { textContent: "Nobody owes anybody. Boring." }));
    moves.forEach(mv => ul2.append(el("li", {}, el("span", { textContent: nameOf(mv.from) + " pays " + nameOf(mv.to) }), el("b", { textContent: moneyFmt(mv.amount) }))));
    resultsArea.append(ul2);
  }

  // ---------- Teams ----------
  function renderTeams() {
    teamsArea.innerHTML = "";
    if (!S.teams.length) return;
    const building = t.status === "setup" && isOwner;
    teamsArea.append(h3el("Teams"));
    if (building) {
      teamsArea.append(el("p", { className: "waiting tb-builder-hint", textContent: "Tap a player to put them on a team. The first player on a team is the captain." }));
      const btns = el("div", { className: "chip-row" },
        el("button", { textContent: "Randomize", onclick: () => autoTeams("random") }),
        el("button", { textContent: "Balance by handicap", onclick: () => autoTeams("balance") }),
        el("button", { textContent: "Clear teams", onclick: () => autoTeams("clear") }));
      btns.style.marginBottom = "12px";
      teamsArea.append(btns);
    }
    const order = t.status === "setup" ? S.teams : S.teams.slice().sort((a, b) => (S.seedOf.get(a.id) || 99) - (S.seedOf.get(b.id) || 99));
    order.forEach(tm => {
      const roster = S.roster(tm.id);
      const blk = el("div", { className: "tb-team" + (tm.id === S.myTeam ? " mine" : "") });
      blk.style.setProperty("--c", tm.color || "var(--glow)");
      const canRename = isOwner || roster.some(p => acct && p.user_id === acct.id && p.is_captain);
      const head = el("div", { className: "tb-team-head" }, el("b", { textContent: (t.status !== "setup" && S.seedOf.get(tm.id) ? S.seedOf.get(tm.id) + ". " : "") + tm.name }),
        el("span", { className: "detail", textContent: roster.length + "/" + t.team_size + " · HCP " + hcpText(S.teamHcp(tm.id)) }));
      blk.append(head);
      if (canRename) {
        const rn = el("button", { className: "link-btn", textContent: "Rename", onclick: () => renameTeam(tm) });
        rn.style.fontSize = "0.85rem";
        blk.append(rn);
      }
      const ul = el("ul", { className: "player-list" });
      if (!roster.length) ul.append(el("li", { className: "waiting", textContent: "Nobody yet" }));
      roster.forEach(p => {
        const li = el("li", {}, el("span", { textContent: p.name + (p.is_captain ? " (captain)" : "") + (acct && p.user_id === acct.id ? " (you)" : "") }),
          el("span", { className: "detail", textContent: "HCP " + hcpText(hcpOf(p)) }));
        if (building) { li.style.cursor = "pointer"; li.onclick = () => memberMenu(p); }
        ul.append(li);
      });
      blk.append(ul);
      teamsArea.append(blk);
    });
  }

  async function renameTeam(tm) {
    const v = await ask("Rename " + tm.name, [{ label: "Team name", value: tm.name, max: 24, placeholder: "Sand Trappers" }], "Save");
    if (!v) return;
    const { error } = await db.from("tournament_teams").update({ name: v[0] }).eq("id", tm.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function autoTeams(kind) {
    if (kind !== "clear" && S.members.length < t.team_count * t.team_size) {
      const ok = await pickFrom("Only " + S.members.length + " of " + t.team_count * t.team_size + " spots can be filled. Build teams anyway?", [{ label: "Build them", value: true }]);
      if (!ok) return;
    }
    const clear = await db.from("tournament_members").update({ team_id: null }).eq("tournament_id", t.id).not("team_id", "is", null);
    if (clear.error) { toast(clear.error.message); return; }
    if (kind !== "clear") {
      const groups = kind === "random"
        ? randomTeams(S.members.map(m => ({ id: m.user_id })), t.team_count, t.team_size)
        : balanceTeams(S.members.map(m => ({ id: m.user_id, hcp: m.hcp, usual_score: m.usual_score })), t.team_count, t.team_size);
      // One slot at a time so the first player on each team is assigned first and becomes captain
      for (let k = 0; k < t.team_size; k++) {
        const res = await Promise.all(groups.map((g, i) => (g[k]
          ? db.from("tournament_members").update({ team_id: S.teams[i].id }).eq("tournament_id", t.id).eq("user_id", g[k]) : null)).filter(Boolean));
        const bad = res.find(r => r.error);
        if (bad) { toast(bad.error.message); break; }
      }
    }
    refresh();
  }

  async function memberMenu(p) {
    const opts = S.teams.filter(tm => tm.id !== p.team_id && S.roster(tm.id).length < t.team_size)
      .map(tm => ({ label: "Put on " + tm.name + " (" + S.roster(tm.id).length + "/" + t.team_size + ")", value: tm.id, color: tm.color }));
    if (p.team_id) opts.unshift({ label: "Take off " + teamName(p.team_id), value: "off" });
    opts.push({ label: "Edit handicap", value: "hcp" });
    if (!acct || p.user_id !== acct.id) opts.push({ label: "Remove from the tournament", value: "remove" });
    const pick = await pickFrom(p.name, opts);
    if (!pick) return;
    if (pick === "hcp") return editHandicap(p);
    if (pick === "remove") {
      const ok = await pickFrom("Remove " + p.name + "? They can join again with the link.", [{ label: "Remove", value: true }]);
      if (!ok) return;
      const { error } = await db.from("tournament_members").delete().eq("tournament_id", t.id).eq("user_id", p.user_id);
      if (error) toast(error.message);
      return refresh();
    }
    const { error } = await db.from("tournament_members").update({ team_id: pick === "off" ? null : pick }).eq("tournament_id", t.id).eq("user_id", p.user_id);
    if (error) toast(error.message);
    refresh();
  }

  async function editHandicap(p) {
    const h = await askSeasonHandicap(acct && p.user_id === acct.id ? null : p.name, hcpOf(p));
    if (h == null) return;
    const { error } = await db.from("tournament_members").update({ hcp: h, usual_score: Math.round(72 + h) }).eq("tournament_id", t.id).eq("user_id", p.user_id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  // ---------- Members ----------
  function renderMembers() {
    membersArea.innerHTML = "";
    if (t.status !== "setup") return;
    const free = S.members.filter(m => !m.team_id);
    membersArea.append(h3el("Who's in (" + S.members.length + " of " + t.team_count * t.team_size + " spots)"));
    const ul = el("ul", { className: "player-list" });
    S.members.forEach(m => {
      const self = acct && m.user_id === acct.id;
      const li = el("li", {}, el("div", {}, el("span", { textContent: m.name + (m.user_id === t.owner_id ? " (creator)" : "") + (self ? " (you)" : "") }),
        el("span", { className: "detail", textContent: (m.team_id ? teamName(m.team_id) : "No team yet") })),
        el("span", { className: "detail", textContent: "HCP " + hcpText(hcpOf(m)) }));
      if (isOwner) { li.style.cursor = "pointer"; li.onclick = () => memberMenu(m); }
      else if (self) { li.style.cursor = "pointer"; li.onclick = () => editHandicap(m); }
      ul.append(li);
    });
    membersArea.append(ul);
    if (isOwner && free.length) membersArea.append(el("p", { className: "waiting", textContent: free.length + (free.length === 1 ? " player needs" : " players need") + " a team." }));
    if (!acct) { accountPrompt(membersArea, "Create an account or sign in to join this tournament."); return; }
    if (S.me) {
      if (!isOwner) {
        const edit = el("button", { className: "btn-ghost", textContent: "Edit my handicap", onclick: () => editHandicap(S.me) });
        edit.style.cssText = "width:100%;margin-top:10px";
        const leave = el("button", { className: "link-btn", textContent: "Leave this tournament", onclick: async () => {
          const ok = await pickFrom("Leave " + t.name + "?", [{ label: "Leave", value: true }]);
          if (!ok) return;
          const { error } = await db.from("tournament_members").delete().eq("tournament_id", t.id).eq("user_id", acct.id);
          if (error) { toast(error.message); return; }
          navTo("/?tournaments");
        } });
        membersArea.append(edit, leave);
      }
    }
  }

  // ---------- Creator tools ----------
  async function writeSeeds(seedMap) {
    const res = await Promise.all([...seedMap].map(([id, s]) => db.from("tournament_teams").update({ seed: s }).eq("id", id)));
    const bad = res.find(r => r.error);
    if (bad) { toast(bad.error.message); return false; }
    return true;
  }

  function renderOwner() {
    ownerArea.innerHTML = "";
    if (!isOwner) return;
    ownerArea.append(h3el("Commissioner tools"));
    const btn = (text, fn, ghost) => {
      const b = el("button", { className: ghost ? "btn-ghost" : "", textContent: text, onclick: fn });
      b.style.cssText = "width:100%;margin-top:10px";
      ownerArea.append(b);
      return b;
    };
    if (t.status === "setup") {
      btn("Edit settings", editSettings, true);
      const seedRow = el("div", { className: "toggle-row" }, el("div", {}, el("span", { className: "field-label", textContent: "Seeding" }),
        el("small", { textContent: "Lowest team handicap is the 1 seed, or shuffle, or swap by hand in the bracket." })));
      const pick = el("div", { className: "fmt-pick" });
      [["handicap", "HCP"], ["random", "Random"], ["manual", "Manual"]].forEach(([k, label]) => {
        const b = el("button", { type: "button", className: "switch" + (t.seeding === k ? " on" : ""), textContent: label, onclick: () => setSeeding(k) });
        pick.append(b);
      });
      seedRow.append(pick);
      seedRow.style.marginTop = "14px";
      ownerArea.append(seedRow);
      const problems = startProblems();
      const start = btn("Start the tournament", startIt);
      if (problems.length) ownerArea.append(el("p", { className: "waiting", textContent: problems[0] }));
      start.disabled = problems.length > 0;
    }
    if (t.status === "active") {
      if (t.schedule === "over_time") {
        ownerArea.append(el("p", { className: "waiting", textContent: "Deadlines are optional. Once one passes, tap any match to advance a team." }));
        const ul = el("ul", { className: "player-list" });
        for (let r = 1; r <= S.R; r++) {
          const m = S.matches.find(x => x.round_no === r && !x.is_third_place);
          const dl = m && m.deadline;
          ul.append(el("li", {}, el("div", {}, el("span", { textContent: roundName(S.R, r) }),
            el("span", { className: "detail", textContent: dl ? "Due " + new Date(dl).toLocaleDateString() : "No deadline" })),
            el("button", { className: "link-btn", textContent: dl ? "Change" : "Set deadline", onclick: () => setDeadline(r, dl) })));
        }
        ownerArea.append(ul);
      }
      btn("End the tournament", async () => {
        const ok = await pickFrom(S.place.first ? "Wrap it up? Results lock." : "End it now? Nobody has won yet. Results lock where they are.", [{ label: "End it", value: true }]);
        if (!ok) return;
        const { error } = await db.rpc("end_tournament", { p_t: t.id });
        if (error) { toast(error.message); return; }
        refresh();
      }, true);
    }
    const del = el("div", { className: "danger-row" });
    del.append(el("button", { className: "link-btn danger", textContent: "Delete tournament", onclick: async () => {
      const ok = await ask("Delete " + t.name + "?", [], "Delete tournament",
        "The bracket, teams and results are gone for everyone. Rounds people played are kept. This can't be undone.", async () => {
          const { error } = await db.rpc("delete_tournament", { p_t: t.id });
          return error ? error.message : null;
        });
      if (ok) { gone = true; navTo("/?tournaments"); }
    } }));
    ownerArea.append(del);
  }

  function startProblems() {
    const out = [];
    const short = S.teams.filter(tm => S.roster(tm.id).length !== t.team_size);
    if (short.length) out.push("Every team needs " + t.team_size + (t.team_size === 1 ? " player" : " players") + ". Check " + short.slice(0, 3).map(x => x.name).join(", ") + (short.length > 3 ? " and more" : "") + ".");
    if (t.schedule === "one_day" && !t.course_id) out.push("Pick a course in settings. The one-day format needs one.");
    if (t.handicap) {
      const missing = S.onTeam.filter(m => m.hcp == null && m.usual_score == null);
      if (missing.length) out.push("Missing a handicap for " + missing.map(m => m.name).join(", ") + ".");
    }
    return out;
  }

  async function editSettings() {
    const form = await tournamentForm(t);
    if (!form) return;
    const { error } = await db.from("tournaments").update(form.row).eq("id", t.id);
    if (error) { toast(error.message); return; }
    bkReset();
    refresh();
  }

  async function setSeeding(k) {
    if (k === "random") {
      const ok = await writeSeeds(seedTeams(S.teams.map(x => ({ id: x.id })), "random"));
      if (!ok) return;
    } else if (k === "manual" && t.seeding === "handicap") {
      if (!(await writeSeeds(S.seedOf))) return;
    }
    const { error } = await db.from("tournaments").update({ seeding: k }).eq("id", t.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function startIt() {
    const problems = startProblems();
    if (problems.length) { toast(problems[0]); return; }
    const extra = S.members.length - S.onTeam.length;
    const ok = await ask("Start " + t.name + "?", [], "Let's go",
      "Teams, seeds and settings lock." + (t.schedule === "one_day" ? " Every team gets its round right away." : "") +
      (extra > 0 ? " " + extra + (extra === 1 ? " player isn't" : " players aren't") + " on a team and will just watch." : ""));
    if (!ok) return;
    const seeds = t.seeding === "handicap" ? S.seedOf
      : seedTeams(S.teams.map(x => ({ id: x.id, hcp: S.teamHcp(x.id), seed: x.seed })), "manual");
    if (!(await writeSeeds(seeds))) return;
    const { error } = await db.rpc("start_tournament", { p_t: t.id });
    if (error) { toast(error.message); refresh(); return; }
    toast("It's on. Good luck. You'll need it.", true);
    bkReset();
    refresh();
  }

  async function setDeadline(r, current) {
    const opts = [{ label: "Pick a date", value: "set" }];
    if (current) opts.push({ label: "Clear the deadline", value: "clear" });
    const pick = await pickFrom("Deadline for the " + roundName(S.R, r), opts);
    if (!pick) return;
    let when = null;
    if (pick === "set") {
      const v = await ask("Deadline for the " + roundName(S.R, r), [{ label: "Last day to play", type: "date", value: current ? isoDay(new Date(current)) : isoDay(new Date(Date.now() + 7 * 864e5)) }], "Save");
      if (!v) return;
      const d = dayOf(v[0]);
      when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
    }
    const { error } = await db.rpc("set_round_deadline", { p_t: t.id, p_round: r, p_deadline: when });
    if (error) { toast(error.message); return; }
    refresh();
  }

  // Phones fire resize when the address bar slides; only redraw when the width actually changed
  window.addEventListener("resize", () => {
    const v = S && box.isConnected && bracketArea.querySelector(".bk-view");
    if (v && v.clientWidth !== bkWidth) renderBracket();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && box.isConnected) refresh(); });
  await refresh();
}

// Not a member yet: show what we can and offer to join
async function tournamentPreview(box, code, acct) {
  const { data: p } = await db.rpc("tournament_by_code", { p_code: code });
  if (!p) { box.append(backBtn("/?tournaments", "All tournaments"), el("p", { className: "gone-note", textContent: "Tournament not found. Check the code." })); return; }
  document.querySelector("h1").textContent = p.name;
  document.querySelector("h1 + p").textContent = TN_STATUS[p.status] + " · Code " + p.code;
  const desk = crabbyDesk();
  box.append(backBtn("/?tournaments", "All tournaments"), infoLink("How tournaments work", () => showRulesModal("Tournaments", ["tournaments"])), desk,
    el("p", { className: "tb-summary", textContent: (MODES[p.mode] || MODES.stroke).name + " · " + p.team_count + " teams of " + p.team_size + " · " +
      TN_SCHEDULE[p.schedule] + (Number(p.buy_in) > 0 ? " · " + moneyFmt(p.buy_in) + " buy-in" : "") + " · " + p.members + " joined" }));
  if (!acct) { desk.say(CRABBY_TOURNEY.guest); accountPrompt(box, "Create an account or sign in to join this tournament."); return; }
  if (p.status !== "setup") { desk.say(CRABBY_TOURNEY.active); box.append(el("p", { className: "waiting", textContent: "This one already started. Ask the creator to add you next time." })); return; }
  desk.say(CRABBY_TOURNEY.join);
  const b = el("button", { textContent: "Join this tournament", onclick: async () => {
    const vals = await ask("Join " + p.name, [{ label: "Your name", placeholder: "What the boys call you", max: 20, value: await accountName() }], "Next");
    if (!vals) return;
    const hcp = await askSeasonHandicap(null);
    if (hcp == null) return;
    const { error } = await db.from("tournament_members").insert({ tournament_id: p.id, name: vals[0], hcp, usual_score: Math.round(72 + hcp) });
    if (error) { toast("Error: " + error.message); return; }
    toast("You're in.", true);
    loadTournament(code);
  } });
  b.style.cssText = "width:100%;margin-top:10px";
  box.append(b);
}

const tourneyBtn = $("tournaments-btn");
if (tourneyBtn) tourneyBtn.onclick = () => navTo("/?tournaments");
