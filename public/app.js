const $ = (id) => document.getElementById(id);

const BASE_COLORS = [
  ["#5CE1FF", "Cyan"], ["#FF5C7A", "Red"], ["#FFD84D", "Yellow"], ["#7CFF6B", "Lime"], ["#B57BFF", "Purple"],
  ["#FF9F43", "Orange"], ["#FF7AE0", "Pink"], ["#4D8BFF", "Blue"], ["#FFFFFF", "White"], ["#3DDBB0", "Teal"],
];
function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return "#" + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const HUE_NAMES = [[15, "red"], [40, "orange"], [55, "amber"], [70, "yellow"], [95, "lime"], [140, "green"], [165, "mint"], [185, "teal"],
  [200, "cyan"], [220, "sky"], [245, "blue"], [265, "indigo"], [285, "violet"], [305, "purple"], [325, "magenta"], [345, "pink"], [361, "red"]];
const hueName = h => HUE_NAMES.find(([max]) => h < max)[1];
const PALETTE = BASE_COLORS.concat(Array.from({ length: 40 }, (_, i) => {
  const hue = (i % 20) * 18 + 9, pale = i >= 20;
  return [hslHex(hue, pale ? 85 : 95, pale ? 80 : 60), (pale ? "Pale " : "Deep ") + hueName(hue)];
}));

function figureEl(color, size = 18, cheer = false) {
  const c = PALETTE.some(p => p[0] === color) ? color : "#8A9BC4";
  const arms = cheer ? "M12 10l-5-6M12 10l5-6" : "M12 11l-5-2M12 11l5-2";
  const w = document.createElement("span");
  w.className = "stick";
  w.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + c +
    '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="filter:drop-shadow(0 0 3px ' + c + ')">' +
    '<circle cx="12" cy="5" r="3"/><path d="M12 8v7' + arms + 'M12 15l-4 6M12 15l4 6"/></svg>';
  return w;
}

function holeAllowances(round, players) {
  const map = {};
  if (!round.handicap) return map;
  const vals = players.map(p => p.usual_score).filter(v => v);
  if (!vals.length) return map;
  const best = Math.min(...vals);
  players.forEach(p => { map[p.id] = p.usual_score ? (p.usual_score - best) / 18 : 0; });
  return map;
}
const netOf = (x, allow) => x.strokes - (allow[x.player_id] || 0);
const validUsual = (v) => { const n = parseInt(v, 10); return n >= 40 && n <= 200; };

function askUsual(title, current) {
  return ask(title || "What do you usually shoot?", [
    { label: "Your usual score for 18 holes", type: "number", placeholder: current ? String(current) : "e.g. 95", max: 3 }
  ], "Lock it in", "Be honest. Everyone will know if you're not.",
  async ([v]) => (validUsual(v) ? null : "Enter a number between 40 and 200."))
  .then(vals => (vals ? parseInt(vals[0], 10) : null));
}

function toggleField(f, panel) {
  const row = document.createElement("div");
  row.className = "toggle-row";
  const txt = document.createElement("div");
  const l = document.createElement("span");
  l.className = "field-label";
  l.textContent = f.label;
  txt.append(l);
  if (f.hint) { const hn = document.createElement("small"); hn.textContent = f.hint; txt.append(hn); }
  const input = document.createElement("input");
  input.type = "hidden";
  input.value = f.on ? "on" : "off";
  const sw = document.createElement("button");
  sw.type = "button";
  sw.className = "switch";
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-label", f.label);
  const sync = () => {
    const on = input.value === "on";
    sw.setAttribute("aria-checked", String(on));
    sw.classList.toggle("on", on);
    sw.textContent = on ? "On" : "Off";
  };
  sw.onclick = () => { input.value = input.value === "on" ? "off" : "on"; sync(); };
  sync();
  row.append(txt, sw, input);
  panel.append(row);
  return input;
}

function colorField(f, panel) {
  const wrap = document.createElement("div");
  const span = document.createElement("span");
  span.className = "field-label";
  span.textContent = f.label;
  const input = document.createElement("input");
  input.type = "hidden";
  const row = document.createElement("div");
  row.className = "swatches";
  PALETTE.forEach(([hex, name]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.disabled = (f.taken || []).includes(hex);
    b.setAttribute("aria-label", name + (b.disabled ? " (taken)" : ""));
    b.append(figureEl(hex, 24));
    b.onclick = () => {
      input.value = hex;
      row.querySelectorAll(".swatch").forEach(x => x.classList.toggle("selected", x === b));
    };
    row.append(b);
  });
  wrap.append(span, row, input);
  panel.append(wrap);
  const first = row.querySelector(".swatch:not(:disabled)");
  if (first) first.click(); else input.value = "-";
  return input;
}

function ask(title, fields, confirmText, note, onSubmit, guide) {
  return new Promise(resolve => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    const panel = document.createElement("form");
    panel.className = "modal-panel";
    const h = document.createElement("h2");
    h.textContent = title;
    panel.append(h);
    if (note) {
      const pn = document.createElement("p");
      pn.className = "modal-note";
      pn.textContent = note;
      panel.append(pn);
    }
    const inputs = fields.map(f => {
      if (f.type === "colors") return colorField(f, panel);
      if (f.type === "toggle") return toggleField(f, panel);
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = f.label;
      const input = document.createElement("input");
      input.placeholder = f.placeholder || "";
      input.maxLength = f.max || 40;
      input.autocomplete = "off";
      if (f.type) input.type = f.type;
      if (f.type === "number") input.inputMode = "numeric";
      if (f.upper) input.style.textTransform = "uppercase";
      label.append(span, input);
      panel.append(label);
      return input;
    });
    const row = document.createElement("div");
    row.className = "modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn-ghost";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.textContent = confirmText;
    row.append(cancel, ok);
    const err = document.createElement("p");
    err.className = "modal-error";
    err.setAttribute("role", "alert");
    panel.append(err, row);
    wrap.append(panel);
    if (guide) {
      const d = crabbyDesk(guide);
      d.classList.add("modal-guide");
      wrap.insertBefore(d, panel);
    }
    document.body.append(wrap);
    setTimeout(() => (inputs[0] || ok).focus(), 50);
    const close = v => { wrap.remove(); resolve(v); };
    cancel.onclick = () => close(null);
    wrap.onclick = e => { if (e.target === wrap) close(null); };
    panel.onsubmit = async e => {
      e.preventDefault();
      const vals = inputs.map(i => i.value.trim());
      const empty = inputs.find(i => !i.value.trim());
      if (empty) { empty.focus(); return; }
      if (onSubmit) {
        err.textContent = "";
        ok.disabled = true;
        const msg = await onSubmit(vals);
        ok.disabled = false;
        if (msg) { err.textContent = msg; return; }
      }
      close(vals);
    };
  });
}

const CHALLENGES = [
  ["Tee Shot Closest to the Pin", 2],
  ["Longest Tee Shot", 2],
  ["Longest Tee Shot in the Fairway", 2],
  ["Second Shot Closest to the Pin", 2],
  ["Longest Second Shot", 1],
  ["Longest Putt Made", 2],
  ["First Putt Closest to the Hole", 1],
  ["Fewest Putts", 1],
  ["First to Hole Out", 1],
  ["Lowest Score on the Hole", 1],
  ["Longest Drive, Any Lie", 1],
  ["CURSE: Tee Shot Furthest From the Pin", -1],
  ["CURSE: Shortest Tee Shot", -1],
  ["CURSE: Second Shot Furthest From the Pin", -1],
  ["CURSE: Most Putts", -1],
  ["CURSE: Shortest Putt Missed", -1],
  ["CURSE: Last to Hole Out", -1],
  ["CURSE: Highest Score on the Hole", -1],
  ["If you only use your putter, you get +2", 2, "multi"],
  ["If you only use your driver, you get +2", 2, "multi"],
  ["If you only use your irons, you get +2", 2, "multi"],
];

const LINES = {
  ace: [
    "HOLE IN ONE for {name} on hole {hole}!! 🤯🏆 Drinks are on {name}.",
    "{name} aced hole {hole}. Frame this scorecard. 🖼️🔥",
    "{name} just holed it in ONE on hole {hole}. Somebody call the news. 📰🤯",
  ],
  two: [
    "{name} shot a 2 on hole {hole}. Wow. 🔥",
    "{name} with a 2 on hole {hole}. Who is this guy? 👀",
    "Dang, {name}. A 2 on hole {hole}. 🎯",
    "{name} put up a 2 on hole {hole}. Somebody drug test him. 🧪",
  ],
  bad: [
    "{name} shot a {n} on hole {hole}... Yikes. 😬",
    "{name} carded a {n} on hole {hole}. Someone check on him.",
    "{name} took {n} swings on hole {hole}. The course is filing a complaint. 📝",
    "{n} on hole {hole} for {name}. Bowling is the other sport, buddy. 🎳",
    "Breaking news: {name} finally finished hole {hole}. Final count: {n}. 📺",
    "{name} put up a {n} on hole {hole}. The ball is asking for a new owner.",
    "{n} strokes on hole {hole}. {name}, blink twice if you need help. 👀",
    "{name} shot {n} on hole {hole}. Legally we have to call that cardio. 🏃",
    "{name} gave the ball a full tour of hole {hole}. {n} stops on the itinerary. 🗺️",
    "{name}: {n} on hole {hole}. Even the cart guy looked away.",
  ],
  disaster: [
    "{name} went 11+ on hole {hole}. We stopped counting out of respect. 🪦",
    "{name}: 11+ on hole {hole}. Somewhere, a golf instructor just felt a chill. 🥶",
    "{name} hit 11+ on hole {hole}. The groundskeeper wants his grass back. 🌱",
    "11+ on hole {hole}. {name} is now legally a landscaper. 🚜",
  ],
};

function scoreLine(name, n, hole) {
  const pool = n === 1 ? LINES.ace : n === 2 ? LINES.two : n >= 11 ? LINES.disaster : n >= 8 ? LINES.bad : null;
  if (!pool) return null;
  return pool[Math.floor(Math.random() * pool.length)]
    .replaceAll("{name}", name).replaceAll("{n}", String(n)).replaceAll("{hole}", String(hole));
}

function challengeFor(code, hole) {
  let seed = 0;
  for (const c of code) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const order = CHALLENGES.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const [text, pts, multi] = CHALLENGES[order[(hole - 1) % order.length]];
  return { text, pts, multi: !!multi };
}

let userPromise = null;
function ensureUser() {
  if (!userPromise) {
    userPromise = (async () => {
      let { data: { session } } = await db.auth.getSession();
      if (!session) {
        const { data, error } = await db.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      return session.user;
    })().catch(err => { userPromise = null; throw err; });
  }
  return userPromise;
}

$("create-round").addEventListener("click", async () => {
  const vals = await ask("Start a new round", [
    { label: "Round name", placeholder: "Saturday Showdown" },
    { label: "Your name", placeholder: "What the boys call you", max: 20 },
    { label: "Pick your stick figure", type: "colors" },
    { label: "Handicaps", type: "toggle", hint: "Levels the field so everyone has a shot" }
  ], "Tee it up", null, null, CRABBY_LINES.welcome);
  if (!vals) return;
  const [roundName, playerName, color, hcpVal] = vals;
  const hcp = hcpVal === "on";
  let usual = null;
  if (hcp) {
    usual = await askUsual();
    if (usual == null) return;
  }
  try {
    await ensureUser();
    const { data: round, error: e1 } = await db.from("rounds")
      .insert({ name: roundName.trim(), handicap: hcp }).select().single();
    if (e1) throw e1;
    const { error: e2 } = await db.from("players")
      .insert({ round_id: round.id, name: playerName.trim(), color: color === "-" ? null : color, usual_score: usual });
    if (e2) throw e2;
    location.href = "/?r=" + round.code;
  } catch (err) {
    $("status").textContent = "Error: " + err.message;
  }
});

const MODES = {
  party: { name: "Party Mode", desc: "Points every hole plus a random challenge card. Bonuses, curses, and bragging rights." },
  stroke: { name: "Stroke Play", desc: "Regular golf rules, lowkey boring but so is your personality." },
  skins: { name: "Skins", desc: "Ties roll the prize into the next hole, so holes stack up. One clutch hole can win you a pile." },
  match: { name: "Match Play", desc: "Every hole is worth exactly 1 point. Ties just cancel out. Win the most holes, win the match." },
  vegas: { name: "Vegas", desc: "2 vs 2. Your team's scores mash into one number, so a 4 and a 5 is 45. Lowest number wins the difference." },
  bestball: { name: "Best Ball", desc: "2 vs 2. Your team's best score on each hole counts. Carry your partner, or get carried." },
  bbb: { name: "Bingo Bango Bongo", desc: "Three points every hole: first on the green, closest to the pin, first in the cup. Anyone can steal them." },
  caddy: { name: "Cart Caddy", desc: "Non-golfers become caddies with ridiculous powers. Call the shot, earn points, fight for Best Caddy." },
  wolf: { name: "Wolf", desc: "Groups of 3 or 4. Pick a partner off the tee or go it alone. Loyalty is optional." },
};

async function loadRound(code) {
  $("create-round").style.display = "none";
  document.querySelectorAll(".home-only").forEach(el => (el.style.display = "none"));
  document.body.classList.add("in-round");
  const box = document.createElement("div");
  box.style.cssText = "margin-top:16px;width:100%;max-width:360px";
  $("status").before(box);

  const user = await ensureUser();
  const fetchRound = () => db.from("rounds").select("*").eq("code", code.toUpperCase()).maybeSingle();
  let { data: round } = await fetchRound();
  if (!round) { box.textContent = "Round not found. Check the code or ask for a new link."; return; }

  document.querySelector("h1").textContent = round.name;
  const sub = document.querySelector("h1 + p");
  const link = location.origin + "/?r=" + round.code;

  let me = null, players = [], scores = [], results = [], picks = [], pairs = [], preds = [], mulls = [], bets = [];
  let hole = 1, strokes = 4, cardReady = false, pickedMode = null;
  const isParty = () => !round.mode || round.mode === "party";
  const isSkins = () => round.mode === "skins";
  const isMatch = () => round.mode === "match";
  const isCaddy = () => round.mode === "caddy";
  const isBbb = () => round.mode === "bbb";
  const isBest = () => round.mode === "bestball";
  const isVegas = () => round.mode === "vegas";
  const isWolf = () => round.mode === "wolf";
  const h3 = (text) => { const el = document.createElement("h3"); el.textContent = text; return el; };

  // ---------- Lobby ----------
  const lobby = document.createElement("div");
  lobby.className = "lobby";

  const linkRow = document.createElement("div");
  linkRow.style.cssText = "display:flex;gap:8px";
  const linkInput = document.createElement("input");
  linkInput.value = link;
  linkInput.readOnly = true;
  linkInput.style.cssText = "flex:1;min-width:0;padding:12px;border-radius:10px;font-size:16px";
  linkInput.onclick = () => linkInput.select();
  const copy = document.createElement("button");
  copy.textContent = "Copy";
  copy.style.cssText = "flex:0 0 112px;padding:12px 0;white-space:nowrap";
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch (e) { linkInput.select(); document.execCommand("copy"); }
    copy.textContent = "Copied!";
    setTimeout(() => (copy.textContent = "Copy"), 1500);
  };
  linkRow.append(linkInput, copy);

  const share = document.createElement("button");
  share.className = "btn-ghost";
  share.textContent = "Share invite link";
  share.onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: round.name, url: link }); } catch (e) {} }
    else { await navigator.clipboard.writeText(link); share.textContent = "Link copied!"; }
  };

  const lobbyList = document.createElement("ul");
  lobbyList.className = "player-list";
  const join = document.createElement("button");
  join.textContent = "Join this round";
  const hostArea = document.createElement("div");
  const waiting = document.createElement("p");
  waiting.className = "waiting";
  waiting.textContent = "Waiting for the host to start the game...";

  const groupTools = document.createElement("div");
  groupTools.style.display = "none";
  const groupHint = document.createElement("p");
  groupHint.className = "waiting";
  groupHint.textContent = "Tap a number to move someone to that group. Each group's co-leader picks their challenge winners.";
  const autoBtn = document.createElement("button");
  autoBtn.className = "btn-ghost";
  autoBtn.textContent = "Randomize groups";
  autoBtn.style.cssText = "width:100%;margin-top:10px";
  autoBtn.onclick = () => autoSplit();
  groupTools.append(groupHint, autoBtn);

  const rejoinBtn = document.createElement("button");
  rejoinBtn.className = "link-btn";
  rejoinBtn.textContent = "I'm already in this round";
  rejoinBtn.onclick = () => rejoin();
  const addPlayerBtn = document.createElement("button");
  addPlayerBtn.className = "btn-ghost";
  addPlayerBtn.textContent = "+ Add a player";
  addPlayerBtn.style.display = "none";
  addPlayerBtn.onclick = () => addOfflinePlayer();
  const teamTools = document.createElement("div");
  teamTools.style.display = "none";
  const teamBtn = document.createElement("button");
  teamBtn.className = "btn-ghost";
  teamBtn.textContent = "Randomize teams";
  teamBtn.style.cssText = "width:100%;margin-top:10px";
  teamBtn.onclick = () => randomizeTeams();
  teamTools.append(teamBtn);
  const guide = crabbyDesk();
  const whoTitle = h3("Who's in");
  [linkRow, share, whoTitle, lobbyList, addPlayerBtn, groupTools, teamTools].forEach(el => el.classList.add("room-only"));
  lobby.append(guide, linkRow, share, whoTitle, lobbyList, addPlayerBtn, groupTools, teamTools, join, rejoinBtn, hostArea, waiting);

  let lobbyUpdateStart = null;
  if (round.host_id === user.id) {
    waiting.style.display = "none";
    const startBtn = document.createElement("button");
    startBtn.textContent = "Pick a mode to start";
    startBtn.disabled = true;
    startBtn.style.width = "100%";
    const SIZES = [["2", "2 players"], ["3", "3 players"], ["4", "4 players"], ["5", "5 or more"]];
    const sizeFits = { "2": n => n === 2, "3": n => n === 3, "4": n => n === 4, "5": n => n >= 5 };
    const MODES_FOR = { "2": ["party", "stroke", "skins", "match", "caddy"], "3": ["party", "stroke", "skins", "match", "wolf", "bbb", "caddy"], "4": ["party", "stroke", "skins", "match", "wolf", "bbb", "bestball", "vegas", "caddy"], "5": ["party", "stroke", "skins", "match", "wolf", "bbb", "bestball", "vegas", "caddy"] };
    const SIZE_NOTES = {
      "2": "Head to head. Nowhere to hide.",
      "3": "A threesome. Every hole is a three-way grudge match.",
      "4": "The classic foursome. Wolf plays best here.",
      "5": "Big group. Split everyone into groups in the lobby and they all play the same game.",
    };
    let pickedSize = null;
    const sizeArea = document.createElement("div");
    const modeArea = document.createElement("div");
    let oneDevice = false;
    try { oneDevice = localStorage.getItem("parful-onedevice-" + round.id) === "1"; } catch (e) {}
    const odRow = document.createElement("div");
    odRow.className = "toggle-row od-row";
    const odTxt = document.createElement("div");
    const odLabel = document.createElement("span");
    odLabel.className = "field-label";
    odLabel.textContent = "One Device Mode";
    const odHint = document.createElement("small");
    odHint.textContent = "Add everyone's names here and keep score for the whole group on this phone. No link needed.";
    odTxt.append(odLabel, odHint);
    const odSwitch = document.createElement("button");
    odSwitch.type = "button";
    odSwitch.className = "switch";
    odSwitch.setAttribute("role", "switch");
    odSwitch.setAttribute("aria-label", "One Device Mode");
    const syncOd = () => {
      odSwitch.textContent = oneDevice ? "On" : "Off";
      odSwitch.classList.toggle("on", oneDevice);
      odSwitch.setAttribute("aria-checked", String(oneDevice));
      addPlayerBtn.style.display = oneDevice ? "block" : "none";
      if (lobbyUpdateStart) lobbyUpdateStart();
    };
    odSwitch.onclick = () => {
      oneDevice = !oneDevice;
      try {
        localStorage.setItem("parful-onedevice-" + round.id, oneDevice ? "1" : "0");
        if (oneDevice) localStorage.setItem("parful-keeper-" + round.id, "1");
      } catch (e) {}
      if (oneDevice) { keeperMode = true; syncKeeper(); }
      syncOd();
    };
    odRow.append(odTxt, odSwitch);
    const odNote = document.createElement("p");
    odNote.className = "waiting";
    odNote.style.display = "none";
    odNote.textContent = "Playing in groups? One device per group. Make someone in each group a co-leader, then have them open the round link on their phone and tap \"I'm already in this round\" to claim their name. They'll keep score for their group.";
    odRow.classList.add("room-only");
    odNote.classList.add("room-only");
    hostArea.append(odRow, odNote);
    syncOd();

    const sizeTitle = h3("How many players?");
    hostArea.append(sizeTitle, sizeArea, modeArea);
    sizeTitle.classList.add("size-only");
    sizeArea.classList.add("size-only");
    modeArea.classList.add("mode-only");

    const showSizeInfo = (key, label) => {
      RULES["size" + key] = [{ h: label, p: [SIZE_NOTES[key]] }].concat(MODES_FOR[key].map(k => ({
        h: MODES[k].name,
        p: [MODES[k].desc + (key === "5" && k === "wolf" ? " Every group needs 3 or 4 players." : "")],
      })));
      showRulesModal("Games for " + label.toLowerCase(), ["size" + key]);
    };

    SIZES.forEach(([key, label]) => {
      const tile = document.createElement("button");
      tile.className = "mode-tile size-tile";
      const b = document.createElement("b");
      b.textContent = label;
      const d = document.createElement("span");
      const list = MODES_FOR[key];
      d.textContent = list.length <= 3 ? list.map(k => MODES[k].name).join(", ") : list.length + " game modes";
      tile.append(b, d);
      tile.onclick = () => {
        pickedSize = key;
        pickedMode = null;
        renderModes();
        updateStart();
        setStep("mode");
      };
      const row = document.createElement("div");
      row.className = "mode-row";
      row.append(tile, infoBtn("Games for " + label, () => showSizeInfo(key, label)));
      sizeArea.append(row);
    });

    const slideIn = (el) => { el.classList.remove("screen-in"); void el.offsetWidth; el.classList.add("screen-in"); };

    function renderModes() {
      modeArea.innerHTML = "";
      renderLobbyList();
      sizeTitle.style.display = pickedSize ? "none" : "";
      sizeArea.style.display = pickedSize ? "none" : "";
      if (!pickedSize) { slideIn(sizeArea); return; }
      const label = SIZES.find(([k]) => k === pickedSize)[1];
      const back = document.createElement("button");
      back.className = "link-btn";
      back.textContent = "Change player count";
      back.onclick = () => { pickedSize = null; pickedMode = null; renderModes(); updateStart(); setStep("size"); };
      modeArea.append(back, h3("Pick a game mode for " + label.toLowerCase()));
      slideIn(modeArea);
      const grid = document.createElement("div");
      grid.className = "mode-grid";
      const preview = document.createElement("p");
      preview.className = "mode-preview";
      preview.setAttribute("aria-live", "polite");
      const showDesc = (key) => {
        preview.textContent = key ? MODES[key].name + ": " + MODES[key].desc
          : "Hover over a game for a quick description. Tap the i for the full rules.";
      };
      MODES_FOR[pickedSize].forEach(key => {
        const m = MODES[key];
        const cell = document.createElement("div");
        cell.className = "mode-cell";
        const tile = document.createElement("button");
        tile.className = "game-tile";
        tile.textContent = m.name;
        tile.onmouseenter = () => showDesc(key);
        tile.onfocus = () => showDesc(key);
        tile.onmouseleave = () => showDesc(pickedMode);
        tile.onblur = () => showDesc(pickedMode);
        tile.onclick = () => {
          pickedMode = key;
          grid.querySelectorAll(".game-tile").forEach(t => t.classList.toggle("selected", t === tile));
          showDesc(key);
          updateStart();
          caddyNote.style.display = key === "caddy" ? "block" : "none";
          nextBtn.disabled = false;
          guide.say(guideLine());
          renderLobbyList();
        };
        const info = infoBtn("How " + m.name + " works", () => showRulesModal(m.name, [key, "round"]));
        info.classList.add("info-corner");
        cell.append(tile, info);
        grid.append(cell);
      });
      modeArea.append(grid, preview);
      const caddyNote = document.createElement("p");
      caddyNote.className = "waiting";
      caddyNote.style.display = pickedMode === "caddy" ? "block" : "none";
      caddyNote.textContent = "Next, you'll set who's golfing and who's caddying.";
      modeArea.append(caddyNote);
      const nextBtn = document.createElement("button");
      nextBtn.textContent = "Next: add players";
      nextBtn.style.cssText = "width:100%;margin-top:14px";
      nextBtn.disabled = !pickedMode;
      nextBtn.onclick = () => setStep("room");
      modeArea.append(nextBtn);
      let tallest = 0;
      [null, ...MODES_FOR[pickedSize]].forEach(k => { showDesc(k); tallest = Math.max(tallest, preview.offsetHeight); });
      preview.style.minHeight = tallest + "px";
      showDesc(pickedMode);
    }

    function updateStart() {
      const n = players.length;
      if ($("money-switch")) syncMoney();
      odNote.style.display = oneDevice && new Set(players.map(p => p.group_no)).size > 1 ? "block" : "none";
      startBtn.disabled = true;
      if (!pickedSize) { startBtn.textContent = "Pick how many are playing"; return; }
      if (!pickedMode) { startBtn.textContent = "Pick a mode to start"; return; }
      if (!sizeFits[pickedSize](n)) {
        const need = pickedSize === "5" ? 5 : +pickedSize;
        startBtn.textContent = n < need ? "Waiting for " + (need - n) + " more" : "Too many players for " + pickedSize;
        return;
      }
      startBtn.disabled = false;
      startBtn.textContent = "Start game";
    }
    const stepBar = document.createElement("div");
    stepBar.className = "room-only step-bar";
    const stepBack = document.createElement("button");
    stepBack.className = "link-btn";
    stepBack.textContent = "Change game";
    stepBack.onclick = () => setStep("mode");
    const stepSummary = document.createElement("span");
    stepSummary.className = "step-summary";
    stepBar.append(stepBack, stepSummary);
    lobby.prepend(stepBar);
    function guideLine() {
      const st = lobby.dataset.step;
      if (st === "size") return CRABBY_LINES.size;
      if (st === "mode") return pickedMode ? CRABBY_LINES.modePicked : CRABBY_LINES.mode;
      if (startBtn.disabled) {
        const need = pickedSize === "5" ? 5 : +pickedSize;
        return players.length < need ? CRABBY_LINES.waitingPlayers : CRABBY_LINES.tooMany;
      }
      if (TEAM_MODES.includes(pickedMode) && [...new Set(players.map(pl => pl.group_no))].some(g => !teamsOf(players, g).valid)) return CRABBY_LINES.teams;
      if (pickedMode === "caddy") {
        const caddies = players.filter(pl => pl.role === "caddy");
        if (!caddies.length || caddies.some(cd => !pairs.some(x => x.caddy_id === cd.id))) return CRABBY_LINES.caddy;
      }
      return CRABBY_LINES.ready;
    }

    let firstStep = true;
    function setStep(st) {
      lobby.dataset.step = st;
      guide.say(guideLine());
      if (st === "room" && pickedMode && pickedSize) {
        stepSummary.textContent = MODES[pickedMode].name + ", " + SIZES.find(([k]) => k === pickedSize)[1].toLowerCase();
      }
      renderLobbyList();
      if (!firstStep) { slideIn(lobby); window.scrollTo(0, 0); }
      firstStep = false;
    }
    setStep("size");

    lobbyUpdateStart = () => { updateStart(); guide.say(guideLine()); };
    updateStart();

    startBtn.onclick = async () => {
      if (!pickedMode) return;
      if (pickedMode === "wolf") {
        const sizes = {};
        players.forEach(pl => (sizes[pl.group_no] = (sizes[pl.group_no] || 0) + 1));
        if (!players.length || Object.values(sizes).some(n => n !== 3 && n !== 4)) { toast("Wolf needs 3 or 4 players in every group."); return; }
      }
      if (TEAM_MODES.includes(pickedMode)) {
        const gs = [...new Set(players.map(pl => pl.group_no))];
        const bad = gs.filter(g => !teamsOf(players, g).valid);
        if (bad.length) { toast("Every group needs 4 players split 2 and 2 into teams." + (gs.length > 1 ? " Check group " + bad.join(", ") + "." : "")); return; }
      }
      if (pickedMode === "caddy") {
        const caddies = players.filter(pl => pl.role === "caddy"), golfers = players.filter(pl => pl.role !== "caddy");
        if (!caddies.length || !golfers.length) { toast("Cart Caddy needs at least one golfer and one caddy."); return; }
        const lonely = caddies.filter(cd => !pairs.some(x => x.caddy_id === cd.id));
        if (lonely.length) { toast(lonely.map(pl => pl.name).join(", ") + " needs a golfer to caddy for."); return; }
      } else if (players.some(pl => pl.role === "caddy")) {
        await Promise.all(players.filter(pl => pl.role === "caddy").map(pl => db.from("players").update({ role: "golfer" }).eq("id", pl.id)));
        await db.from("caddy_pairs").delete().eq("round_id", round.id);
      }
      if (oneDevice) {
        const gs = [...new Set(players.map(p => p.group_no))];
        const leaderGroup = (players.find(p => p.user_id === round.host_id) || {}).group_no;
        const missing = gs.filter(g => g !== leaderGroup && !players.some(p => p.group_no === g && p.is_co_leader && p.user_id));
        if (gs.length > 1 && missing.length) {
          toast("Group " + missing.join(", ") + " needs a co-leader who's claimed their spot on their own phone.");
          return;
        }
      }
      if (stakes === "pot") {
        const pot = num("m-buyin") * payers(), sum = num("m-p1") + num("m-p2") + num("m-p3");
        if (!pot) { toast("Enter a buy-in, or turn off Play for money."); return; }
        if (Math.round((pot - sum) * 100) !== 0) { toast("Payouts need to add up to the " + moneyFmt(pot) + " pot."); return; }
      }
      if (stakes === "point" && !num("m-per")) { toast("Enter a dollar amount per point, or turn off Play for money."); return; }
      const yes = await ask("Start the game?", [], "Let's play", "No one can join the round once the game has begun.");
      if (!yes) return;
      startBtn.disabled = true;
      const { error } = await db.from("rounds").update({ status: "playing", mode: pickedMode, ...moneyFields() }).eq("id", round.id);
      if (error) { toast("Error: " + error.message); startBtn.disabled = false; return; }
      refresh();
    };
    let stakes = "none";
    const money = document.createElement("div");
    money.className = "room-only money-box";
    money.innerHTML = `
      <div class="toggle-row">
        <div><span class="field-label">Play for money</span><small>Parful keeps track. You settle up yourselves.</small></div>
        <button type="button" class="switch" id="money-switch" role="switch" aria-label="Play for money"></button>
      </div>
      <div id="money-opts" style="display:none">
        <div class="chip-row" id="money-type">
          <button type="button" data-t="pot">Buy-in pot</button>
          <button type="button" data-t="point">Per point</button>
        </div>
        <div id="money-pot">
          <label class="money-field"><span>Buy-in per player ($)</span><input id="m-buyin" type="number" inputmode="decimal" min="0" step="1" placeholder="20"></label>
          <p class="money-total" id="m-pot"></p>
          <div class="money-places">
            <label class="money-field"><span>1st ($)</span><input id="m-p1" type="number" inputmode="decimal" min="0"></label>
            <label class="money-field"><span>2nd ($)</span><input id="m-p2" type="number" inputmode="decimal" min="0"></label>
            <label class="money-field"><span>3rd ($)</span><input id="m-p3" type="number" inputmode="decimal" min="0"></label>
          </div>
          <button type="button" class="link-btn" id="m-split">Fill in a 60 / 30 / 10 split</button>
          <p class="money-check" id="m-check"></p>
        </div>
        <div id="money-point" style="display:none">
          <label class="money-field"><span id="m-unit">Dollars per point</span><input id="m-per" type="number" inputmode="decimal" min="0" step="0.5" placeholder="1"></label>
          <p class="cp-note">At the end, everyone settles the point difference with everyone else.</p>
        </div>
      </div>`;
    hostArea.append(money);
    const mq = (id) => money.querySelector("#" + id);
    const num = id => { const v = parseFloat(mq(id).value); return isNaN(v) || v < 0 ? 0 : Math.round(v * 100) / 100; };
    const payers = () => (pickedMode === "caddy" ? players.filter(pl => pl.role === "caddy").length : players.length);
    function syncMoney() {
      const on = stakes !== "none";
      const sw = mq("money-switch");
      sw.textContent = on ? "On" : "Off";
      sw.classList.toggle("on", on);
      sw.setAttribute("aria-checked", String(on));
      mq("money-opts").style.display = on ? "block" : "none";
      mq("money-type").querySelectorAll("button").forEach(b => b.classList.toggle("selected", b.dataset.t === stakes));
      mq("money-pot").style.display = stakes === "pot" ? "block" : "none";
      mq("money-point").style.display = stakes === "point" ? "block" : "none";
      mq("m-unit").textContent = pickedMode === "stroke" ? "Dollars per stroke" : pickedMode === "skins" ? "Dollars per skin" : "Dollars per point";
      const pot = num("m-buyin") * payers();
      const np = payers();
      mq("m-pot").textContent = "Pot: " + moneyFmt(pot) + " (" + np + (pickedMode === "caddy" ? (np === 1 ? " caddy)" : " caddies)") : (np === 1 ? " player)" : " players)"));
      const diff = Math.round((pot - num("m-p1") - num("m-p2") - num("m-p3")) * 100) / 100;
      const check = mq("m-check");
      check.textContent = !pot ? "" : diff === 0 ? "Payouts match the pot." : diff > 0 ? moneyFmt(diff) + " left to hand out." : "Payouts are " + moneyFmt(-diff) + " over the pot.";
      check.classList.toggle("bad", !!pot && diff !== 0);
    }
    mq("money-switch").onclick = () => { stakes = stakes === "none" ? "pot" : "none"; syncMoney(); };
    mq("money-type").querySelectorAll("button").forEach(b => (b.onclick = () => { stakes = b.dataset.t; syncMoney(); }));
    ["m-buyin", "m-p1", "m-p2", "m-p3", "m-per"].forEach(id => (mq(id).oninput = syncMoney));
    mq("m-split").onclick = () => {
      const pot = num("m-buyin") * payers();
      if (!pot) { toast("Enter a buy-in first."); return; }
      const a = Math.round(pot * 0.6), b = Math.round(pot * 0.3);
      mq("m-p1").value = a; mq("m-p2").value = b; mq("m-p3").value = Math.round((pot - a - b) * 100) / 100;
      syncMoney();
    };
    const moneyFields = () => stakes === "pot"
      ? { stakes, buy_in: num("m-buyin"), payouts: [num("m-p1"), num("m-p2"), num("m-p3")], per_point: null }
      : stakes === "point" ? { stakes, per_point: num("m-per"), buy_in: null, payouts: null }
      : { stakes: "none", buy_in: null, payouts: null, per_point: null };
    syncMoney();

    startBtn.classList.add("room-only");
    hostArea.append(startBtn);
  }

  // ---------- Game ----------
  const game = document.createElement("div");
  game.className = "game";
  game.style.display = "none";

  const card = document.createElement("div");
  card.style.cssText = "padding:16px;border-radius:14px;background:rgba(255,255,255,0.06)";
  card.innerHTML = `
    <div id="hole-strip" class="hole-strip"></div>
    <div class="hole-head"><b id="hole-label"></b><span id="hole-mine"></span></div>
    <div id="ch-box" class="ch-box">
      <div class="ch-kicker">Challenge</div>
      <div id="ch-text" class="ch-text"></div>
      <div id="ch-winner" class="ch-winner"></div>
      <div id="ch-pick" class="chip-row"></div>
    </div>
    <div id="wolf-box" class="ch-box" style="display:none">
      <div class="ch-kicker">The Wolf</div>
      <div id="wolf-name" class="ch-text"></div>
      <div id="wolf-tee" class="ch-winner"></div>
      <div id="wolf-teams" class="ch-winner" style="margin-top:6px"></div>
      <div id="wolf-pick" class="chip-row"></div>
    </div>
    <div id="keeper-row" class="chip-row keeper-row"></div>
    <div id="vegas-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Vegas</div>
      <div id="vegas-teams" class="ch-text"></div>
      <div id="vegas-result" class="ch-winner"></div>
    </div>
    <div id="best-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Best Ball</div>
      <div id="best-teams" class="ch-text"></div>
      <div id="best-result" class="ch-winner"></div>
    </div>
    <div id="bbb-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Bingo Bango Bongo</div>
      <div id="bbb-rows"></div>
    </div>
    <div id="caddy-box" style="display:none"></div>
    <div id="match-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Match Play</div>
      <div id="match-status" class="ch-text"></div>
      <div id="match-result" class="ch-winner"></div>
    </div>
    <div id="skins-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Skins</div>
      <div id="skins-pot" class="ch-text"></div>
      <div id="skins-result" class="ch-winner"></div>
    </div>
    <div id="score-label" class="score-label">Your score</div>
    <div id="score-grid" class="score-grid"></div>
    <p id="waiting-on" class="waiting"></p>`;

  const board = document.createElement("ul");
  board.className = "player-list";

  const lateWrap = document.createElement("div");
  const lateNote = document.createElement("p");
  lateNote.className = "waiting";
  lateNote.textContent = "This game already started, so no new players can join. Got disconnected? Grab your spot back.";
  const lateJoin = document.createElement("button");
  lateJoin.textContent = "I'm already in this round";
  lateJoin.style.cssText = "width:100%;margin-top:10px";
  lateWrap.append(lateNote, lateJoin);

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  const panels = {}, tabBtns = {};
  [["hole", "Hole 1"], ["board", "Leaderboard"], ["chat", "Chat"], ["bets", "Bets"], ["rules", "Rules"]].forEach(([key, label]) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.textContent = label;
    b.onclick = () => showTab(key);
    tabs.append(b);
    tabBtns[key] = b;
    panels[key] = document.createElement("div");
  });
  tabBtns.rules.classList.add("tab-small");
  panels.hole.append(card);
  const finishBtn = document.createElement("button");
  finishBtn.className = "btn-ghost";
  finishBtn.textContent = "Finish round";
  finishBtn.style.cssText = "width:100%;margin-top:16px";
  finishBtn.style.display = round.host_id === user.id ? "block" : "none";
  finishBtn.onclick = async () => {
    const yes = await ask("Finish the round?", [], "Finish it", "Scores lock for everyone and the final results go up.");
    if (!yes) return;
    const { error } = await db.from("rounds").update({ status: "finished" }).eq("id", round.id);
    if (error) { toast("Error: " + error.message); return; }
    refresh();
  };
  panels.hole.append(finishBtn);
  const stakesLine = document.createElement("p");
  stakesLine.className = "waiting";
  stakesLine.style.cssText = "display:none;margin:0 0 8px";
  panels.board.append(stakesLine, board);

  const betForm = document.createElement("form");
  betForm.className = "bet-form";
  betForm.innerHTML = '<div class="field-label">Post a side bet</div>' +
    '<input id="bet-text" maxlength="140" placeholder="Jake breaks 90" autocomplete="off">' +
    '<div class="cp-row"><input id="bet-amt" type="number" inputmode="decimal" min="1" step="1" placeholder="$10"><button type="submit">Post bet</button></div>' +
    '<div id="bet-for" class="chip-row"></div>';
  const betList = document.createElement("div");
  panels.bets.append(betForm, betList);
  let betPoster = null;
  const betChat = (body) => db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto", body: body.slice(0, 280) }).then(() => {});
  betForm.onsubmit = async (e) => {
    e.preventDefault();
    const body = $("bet-text").value.trim();
    const amount = Math.round(parseFloat($("bet-amt").value) * 100) / 100;
    const poster = players.find(pl => pl.id === betPoster) || me;
    if (!body || !(amount > 0)) { toast("Describe the bet and set an amount."); return; }
    if (!poster) return;
    const { error } = await db.from("bets").insert({ round_id: round.id, creator_id: poster.id, body, amount });
    if (error) { toast(error.message); return; }
    $("bet-text").value = "";
    $("bet-amt").value = "";
    betChat("💸 " + poster.name + " bet " + moneyFmt(amount) + ": \u201C" + body + "\u201D. Who's taking it?");
    refresh();
  };
  let messages = [], unread = 0, activeTab = "hole";
  const chatList = document.createElement("div");
  chatList.className = "chat-list";
  const chatForm = document.createElement("form");
  chatForm.className = "chat-form";
  const chatInput = document.createElement("input");
  chatInput.placeholder = "Talk your trash";
  chatInput.maxLength = 280;
  chatInput.autocomplete = "off";
  const chatSend = document.createElement("button");
  chatSend.type = "submit";
  chatSend.textContent = "Send";
  chatForm.append(chatInput, chatSend);
  panels.chat.append(chatList, chatForm);
  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const body = chatInput.value.trim();
    if (!body || !me) return;
    chatInput.value = "";
    const { error } = await db.from("messages").insert({ round_id: round.id, player_id: me.id, body });
    if (error) { toast(error.message); chatInput.value = body; }
  };

  function updateChatTab() {
    tabBtns.chat.textContent = "Chat" + (unread ? " (" + unread + ")" : "");
  }

  function renderChat() {
    chatList.innerHTML = "";
    if (!messages.length) {
      const empty = document.createElement("p");
      empty.className = "waiting";
      empty.textContent = "No trash talk yet. Start it.";
      chatList.append(empty);
      return;
    }
    messages.forEach(m => {
      if (m.kind === "auto") {
        const d = document.createElement("div");
        d.className = "chat-auto";
        m.body.split(/(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u).forEach((part, k) => {
          if (!part) return;
          if (k % 2) { const e = document.createElement("span"); e.className = "emoji"; e.textContent = part; d.append(e); }
          else d.append(part);
        });
        chatList.append(d);
        return;
      }
      const pl = players.find(p => p.id === m.player_id);
      const d = document.createElement("div");
      d.className = "chat-msg";
      const txt = document.createElement("div");
      const who = document.createElement("b");
      who.textContent = pl ? pl.name : "Someone";
      const body = document.createElement("span");
      body.textContent = m.body;
      txt.append(who, body);
      d.append(figureEl(pl && pl.color), txt);
      chatList.append(d);
    });
    chatList.scrollTop = chatList.scrollHeight;
  }

  async function loadMessages() {
    const { data } = await db.from("messages").select("*").eq("round_id", round.id).order("created_at").limit(300);
    messages = data || [];
    renderChat();
  }

  function onMessage(m) {
    if (messages.some(x => x.id === m.id)) return;
    messages.push(m);
    renderChat();
    Sound.play("blip");
    if (activeTab !== "chat") { unread += 1; updateChatTab(); }
  }
  function showTab(key) {
    activeTab = key;
    if (key === "rules") { panels.rules.innerHTML = ""; renderRules(panels.rules, [RULES[round.mode] ? round.mode : "party", "round"]); }
    if (key === "chat") { unread = 0; updateChatTab(); setTimeout(() => (chatList.scrollTop = chatList.scrollHeight), 0); }
    Object.entries(panels).forEach(([k, el]) => (el.style.display = k === key ? "block" : "none"));
    Object.entries(tabBtns).forEach(([k, b]) => b.classList.toggle("active", k === key));
  }
  game.append(lateWrap, tabs, panels.hole, panels.board, panels.chat, panels.bets, panels.rules);
  showTab("hole");
  let playedFinale = false;
  const scoreArea = document.createElement("div");
  scoreArea.style.display = "none";
  scoreArea.className = "results";
  box.append(lobby, game, scoreArea);

  const copyTop = document.createElement("button");
  copyTop.className = "copy-top";
  copyTop.textContent = "Copy link";
  copyTop.style.display = "none";
  copyTop.onclick = async () => {
    try { await navigator.clipboard.writeText(link); }
    catch (e) { toast("Couldn't copy. The round code is " + round.code); return; }
    copyTop.textContent = "Copied!";
    setTimeout(() => (copyTop.textContent = "Copy link"), 1500);
  };
  const homeTop = document.createElement("button");
  homeTop.className = "copy-top";
  homeTop.textContent = "Home";
  homeTop.onclick = () => (location.href = "/");
  const topBar = document.createElement("div");
  topBar.className = "top-actions";
  let keeperMode = false, scoringFor = null;
  const canKeep = () => round.host_id === user.id || (!!me && me.is_co_leader);
  try { keeperMode = localStorage.getItem("parful-keeper-" + round.id) === "1"; } catch (e) {}
  const keeperTop = document.createElement("button");
  keeperTop.className = "copy-top";
  const syncKeeper = () => {
    keeperTop.textContent = "Scorekeeper: " + (keeperMode ? "On" : "Off");
    keeperTop.classList.toggle("on", keeperMode);
    keeperTop.setAttribute("aria-pressed", String(keeperMode));
  };
  keeperTop.onclick = () => {
    keeperMode = !keeperMode;
    scoringFor = null;
    try { localStorage.setItem("parful-keeper-" + round.id, keeperMode ? "1" : "0"); } catch (e) {}
    syncKeeper();
    if (me) drawCard();
  };
  syncKeeper();
  const keeperWrap = document.createElement("span");
  keeperWrap.className = "tip-wrap";
  keeperWrap.style.display = "none";
  const keeperTip = document.createElement("span");
  keeperTip.className = "tip";
  keeperTip.id = "keeper-tip";
  keeperTip.setAttribute("role", "tooltip");
  keeperTip.textContent = "Enter scores for everyone in your group from this phone. Handy when only one phone is out.";
  keeperTop.setAttribute("aria-describedby", "keeper-tip");
  keeperWrap.append(keeperTop, keeperTip);
  topBar.append(homeTop, copyTop, keeperWrap, soundButton());
  document.body.append(topBar);

  function renderLobbyList() {
    const isLeader = round.host_id === user.id;
    const tournament = players.length > 4 || players.some(p => p.group_no > 1);
    const groupCount = Math.max(1, Math.ceil(players.length / 4), ...players.map(p => p.group_no));
    groupTools.style.display = isLeader && players.length > 4 ? "block" : "none";
    teamTools.style.display = isLeader && TEAM_MODES.includes(pickedMode) ? "block" : "none";
    lobbyList.innerHTML = "";
    const groups = tournament ? Array.from({ length: groupCount }, (_, i) => i + 1) : [null];
    groups.forEach(g => {
      const members = g == null ? players : players.filter(p => p.group_no === g);
      if (g != null) {
        const head = document.createElement("li");
        head.className = "group-head";
        head.textContent = "Group " + g;
        lobbyList.append(head);
        if (!members.length) {
          const empty = document.createElement("li");
          empty.className = "waiting";
          empty.textContent = "Nobody yet";
          lobbyList.append(empty);
        }
      }
      members.forEach(pl => {
        const li = document.createElement("li");
        li.className = "lobby-player";
        const name = document.createElement("span");
        name.textContent = pl.name
          + (pl.user_id === round.host_id ? " (party leader)" : "")
          + (pl.is_co_leader ? " (co-leader)" : "")
          + (pl.team ? " (" + TEAM_NAMES[pl.team] + ")" : "")
          + (pl.role === "caddy" ? " (caddy" + (pairs.some(x => x.caddy_id === pl.id)
              ? " for " + pairs.filter(x => x.caddy_id === pl.id).map(x => (players.find(g => g.id === x.golfer_id) || {}).name).filter(Boolean).join(", ")
              : "") + ")" : "")
          + (pl.user_id === user.id ? " (you)" : "");
        name.prepend(figureEl(pl.color));
        li.append(name);
        if (round.handicap) {
          const txt = "Shoots " + (pl.usual_score || "?");
          if (isLeader) {
            const eb = document.createElement("button");
            eb.className = "mini";
            eb.textContent = txt + " (edit)";
            eb.onclick = () => editUsual(pl);
            li.append(eb);
          } else {
            const sp = document.createElement("span");
            sp.className = "detail";
            sp.textContent = txt;
            li.append(sp);
          }
        }
        if (isLeader && TEAM_MODES.includes(pickedMode)) {
          const tctl = document.createElement("div");
          tctl.className = "lobby-ctl";
          [1, 2].forEach(n => {
            const b = document.createElement("button");
            b.className = "mini" + (pl.team === n ? " selected" : "");
            b.textContent = TEAM_NAMES[n];
            b.onclick = () => setTeam(pl, n);
            tctl.append(b);
          });
          li.append(tctl);
        }
        if (isLeader && pickedMode === "caddy") {
          const ctl = document.createElement("div");
          ctl.className = "lobby-ctl";
          [["golfer", "Golfer"], ["caddy", "Caddy"]].forEach(([role, label]) => {
            const b = document.createElement("button");
            b.className = "mini" + ((pl.role || "golfer") === role ? " selected" : "");
            b.textContent = label;
            b.onclick = () => setRole(pl, role);
            ctl.append(b);
          });
          if (pl.role === "caddy") {
            players.filter(gp => gp.role !== "caddy" && gp.group_no === pl.group_no).forEach(gp => {
              const on = pairs.some(x => x.caddy_id === pl.id && x.golfer_id === gp.id);
              const b = document.createElement("button");
              b.className = "mini" + (on ? " selected" : "");
              b.append(figureEl(gp.color, 14), "Caddies for " + gp.name);
              b.onclick = () => togglePair(pl, gp, on);
              ctl.append(b);
            });
          }
          li.append(ctl);
        }
        if (isLeader && pl.user_id !== round.host_id) {
          const rm = document.createElement("button");
          rm.className = "mini";
          rm.textContent = "Remove";
          rm.onclick = () => removePlayer(pl);
          li.append(rm);
        }
        if (isLeader && tournament) {
          const ctl = document.createElement("div");
          ctl.className = "lobby-ctl";
          for (let n = 1; n <= groupCount; n++) {
            const b = document.createElement("button");
            b.className = "mini" + (pl.group_no === n ? " selected" : "");
            b.textContent = n;
            b.setAttribute("aria-label", "Move " + pl.name + " to group " + n);
            b.onclick = () => setGroup(pl, n);
            ctl.append(b);
          }
          if (pl.user_id !== round.host_id) {
            const co = document.createElement("button");
            co.className = "mini co" + (pl.is_co_leader ? " selected" : "");
            co.textContent = pl.is_co_leader ? "Co-leader" : "Make co-leader";
            co.onclick = () => toggleCo(pl);
            ctl.append(co);
          }
          li.append(ctl);
        }
        lobbyList.append(li);
      });
    });
  }

  async function setTeam(pl, n) {
    if (pl.team === n) return;
    const { error } = await db.from("players").update({ team: n }).eq("id", pl.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function randomizeTeams() {
    const ups = [];
    [...new Set(players.map(p => p.group_no))].forEach(g => {
      const grp = players.filter(p => p.group_no === g);
      for (let i = grp.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [grp[i], grp[j]] = [grp[j], grp[i]];
      }
      grp.forEach((p, i) => ups.push(db.from("players").update({ team: (i % 2) + 1 }).eq("id", p.id)));
    });
    const res = await Promise.all(ups);
    const bad = res.find(r => r.error);
    if (bad) toast(bad.error.message);
    refresh();
  }

  async function setRole(pl, role) {
    if ((pl.role || "golfer") === role) return;
    const clear = role === "golfer"
      ? await db.from("caddy_pairs").delete().eq("caddy_id", pl.id)
      : await db.from("caddy_pairs").delete().eq("golfer_id", pl.id);
    if (clear.error) { toast(clear.error.message); return; }
    const { error } = await db.from("players").update({ role }).eq("id", pl.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function togglePair(caddy, golfer, on) {
    const { error } = on
      ? await db.from("caddy_pairs").delete().eq("caddy_id", caddy.id).eq("golfer_id", golfer.id)
      : await db.from("caddy_pairs").insert({ round_id: round.id, caddy_id: caddy.id, golfer_id: golfer.id });
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function addOfflinePlayer() {
    const vals = await ask("Add a player", [
      { label: "Their name", placeholder: "What the boys call them", max: 20 },
      { label: "Pick their stick figure", type: "colors", taken: players.map(p => p.color) },
      ...(round.handicap ? [{ label: "What do they usually shoot for 18?", type: "number", placeholder: "e.g. 95", max: 3 }] : [])
    ], "Add", null, async (v) => (round.handicap && !validUsual(v[2]) ? "Enter their usual score for 18 holes (40 to 200)." : null));
    if (!vals) return;
    const { error } = await db.from("players").insert({
      round_id: round.id, user_id: null, name: vals[0],
      color: vals[1] === "-" ? null : vals[1],
      usual_score: round.handicap ? parseInt(vals[2], 10) : null,
    });
    if (error) { toast(error.code === "23505" ? "That color's taken. Pick another." : error.message); return; }
    refresh();
  }

  async function removePlayer(pl) {
    const yes = await ask("Remove " + pl.name + "?", [], "Remove", "If they have the link, they can join again.");
    if (!yes) return;
    const { error } = await db.from("players").delete().eq("id", pl.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function editUsual(pl) {
    const v = await askUsual("Edit " + pl.name + "'s usual score", pl.usual_score);
    if (v == null) return;
    const { error } = await db.from("players").update({ usual_score: v }).eq("id", pl.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function setGroup(pl, n) {
    if (pl.group_no === n) return;
    const { error } = await db.from("players").update({ group_no: n, is_co_leader: false }).eq("id", pl.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function toggleCo(pl) {
    if (!pl.is_co_leader) {
      const clear = await db.from("players").update({ is_co_leader: false })
        .eq("round_id", round.id).eq("group_no", pl.group_no);
      if (clear.error) { toast(clear.error.message); return; }
    }
    const { error } = await db.from("players").update({ is_co_leader: !pl.is_co_leader }).eq("id", pl.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function autoSplit() {
    const shuffled = players.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const groups = Math.ceil(shuffled.length / 4);
    const res = await Promise.all(shuffled.map((pl, i) =>
      db.from("players").update({ group_no: (i % groups) + 1, is_co_leader: false }).eq("id", pl.id)));
    const bad = res.find(r => r.error);
    if (bad) toast(bad.error.message);
    refresh();
  }

  // ---------- Data + render ----------
  async function refresh() {
    const [r, p, sc, c, wp, cp, pr, mu, bt] = await Promise.all([
      fetchRound(),
      db.from("players").select("*").eq("round_id", round.id).order("created_at"),
      db.from("scores").select("*").eq("round_id", round.id),
      db.from("challenge_results").select("*").eq("round_id", round.id),
      db.from("wolf_picks").select("*").eq("round_id", round.id),
      db.from("caddy_pairs").select("*").eq("round_id", round.id),
      db.from("predictions").select("*").eq("round_id", round.id),
      db.from("mulligans").select("*").eq("round_id", round.id),
      db.from("bets").select("*").eq("round_id", round.id).order("created_at"),
    ]);
    if (r.data) round = r.data;
    players = p.data || [];
    scores = sc.data || [];
    results = c.data || [];
    picks = (wp && wp.data) || [];
    pairs = (cp && cp.data) || [];
    preds = (pr && pr.data) || [];
    mulls = (mu && mu.data) || [];
    bets = (bt && bt.data) || [];
    me = players.find(pl => pl.user_id === user.id) || null;
    render();
  }

  function render() {
    const playing = round.status === "playing";
    const finished = round.status === "finished";
    lobby.style.display = round.status === "lobby" ? "block" : "none";
    game.style.display = playing ? "block" : "none";
    document.body.classList.toggle("has-rail", playing);
    Sound.music(!playing);
    if (finished && !playedFinale) { playedFinale = true; Sound.play("fanfare"); }
    stakesLine.textContent = moneySummary(round);
    stakesLine.style.display = stakesLine.textContent ? "block" : "none";
    if (playing) renderBets();
    const showCopy = round.status !== "lobby";
    copyTop.style.display = showCopy ? "block" : "none";
    keeperWrap.style.display = playing && canKeep() ? "inline-block" : "none";
    if (playing && canKeep() && me) {
      let stored = null;
      try { stored = localStorage.getItem("parful-keeper-" + round.id); } catch (e) {}
      if (stored === null && players.some(p => p.group_no === me.group_no && !p.user_id)) {
        keeperMode = true;
        syncKeeper();
        try { localStorage.setItem("parful-keeper-" + round.id, "1"); } catch (e) {}
      }
    }
    document.body.classList.add("has-copy");
    scoreArea.style.display = finished ? "block" : "none";
    if (finished) renderScorecard(scoreArea, { round, players, scores, results, user, picks, preds, mulls, bets });
    sub.textContent = finished ? "Final results" : playing
      ? (MODES[round.mode] || MODES.party).name + (round.handicap ? " with handicaps" : "")
      : "Round code: " + round.code + (round.handicap ? ", handicaps on" : "");
    renderLobbyList();
    if (lobbyUpdateStart) lobbyUpdateStart();
    if (round.host_id !== user.id) guide.say(me ? CRABBY_LINES.joined : CRABBY_LINES.joiner);
    join.style.display = me ? "none" : "block";
    rejoinBtn.style.display = !me && players.length ? "inline-block" : "none";
    if (playing) renderGame();
  }

  function renderGame() {
    const played = scores.filter(x => x.strokes);
    const allow = holeAllowances(round, players);
    const wolfTot = isWolf() ? wolfTotals(round, players, scores, picks) : {};
    const skinTot = isSkins() ? skinsState(round, players, scores).totals : {};
    const matchWon = isMatch() ? matchTotals(round, players, scores) : {};
    const bestTot = isBest() ? bestBallTotals(round, players, scores) : {};
    const vegasTot = isVegas() ? vegasTotals(round, players, scores) : {};
    const rows = players.map(pl => {
      const mine = played.filter(x => x.player_id === pl.id);
      const total = mine.reduce((a, x) => a + x.strokes, 0);
      let pts = 0;
      if (isParty()) {
        mine.forEach(m => { pts += 1 + played.filter(o => o.hole === m.hole && netOf(o, allow) > netOf(m, allow)).length; });
        results.filter(r => r.winner_id === pl.id).forEach(r => { pts += r.points; });
      }
      if (isWolf()) pts = wolfTot[pl.id] || 0;
      if (isSkins()) pts = skinTot[pl.id] || 0;
      if (isMatch()) pts = matchWon[pl.id] || 0;
      if (isBbb()) pts = results.filter(x => x.award && x.winner_id === pl.id).length;
      if (isBest()) pts = bestTot[pl.id] || 0;
      if (isVegas()) pts = vegasTot[pl.id] || 0;
      return { pl, pts, total, net: total - (allow[pl.id] || 0) * mine.length, thru: mine.length };
    });
    if (isParty() || isWolf() || isSkins() || isMatch() || isBbb() || isBest() || isVegas()) rows.sort((a, b) => b.pts - a.pts);
    else { const avg = r => (r.thru ? r.net / r.thru : Infinity); rows.sort((a, b) => avg(a) - avg(b)); }

    board.innerHTML = "";
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.append((i + 1) + ". ", figureEl(r.pl.color), r.pl.name + (r.pl.user_id === user.id ? " (you)" : ""));
      const val = document.createElement("span");
      val.textContent = (isParty() || isWolf() || isSkins() || isMatch() || isBbb() || isBest() || isVegas())
        ? r.pts + (isSkins() ? (r.pts === 1 ? " skin" : " skins") : isMatch() ? (r.pts === 1 ? " hole won" : " holes won") : " pts")
        : (r.thru ? r.total + " strokes" + (round.handicap ? ", net " + Math.round(r.net) : "") + " (thru " + r.thru + ")" : "-");
      if ((isParty() || isWolf() || isSkins() || isMatch() || isBbb() || isBest() || isVegas()) && r.thru) {
        const sub = document.createElement("span");
        sub.className = "sub-score";
        sub.textContent = " (" + r.total + " thru " + r.thru + ")";
        val.append(sub);
      }
      li.append(name, val);
      board.appendChild(li);
    });

    if (isCaddy()) renderCaddyBoard();
    card.style.display = me ? "block" : "none";
    lateWrap.style.display = me ? "none" : "block";
    const prog = groupProgressHole();
    if (me && !cardReady) {
      cardReady = true;
      setHole(prog);
      maybeIntro(prog);
    } else if (me && lastProgress !== null && prog > lastProgress && hole === lastProgress) {
      setHole(prog);
      maybeIntro(prog);
    } else if (me) drawCard();
    lastProgress = prog;
  }

  const myScores = () => (me ? scores.filter(x => x.player_id === me.id) : []);

  function setHole(h) {
    hole = Math.min(groupProgressHole(), 18, Math.max(1, h));
    scoringFor = null;
    const ex = myScores().find(x => x.hole === hole);
    strokes = ex ? ex.strokes : 4;
    drawCard();
  }

  let stripHole = 0;
  let lastProgress = null;

  function groupProgressHole() {
    const g = me ? me.group_no : 1;
    const group = players.filter(p => p.group_no === g && p.role !== "caddy");
    let h = 1;
    while (h < 18 && group.length && group.every(p => scores.some(x => x.player_id === p.id && x.hole === h && x.strokes))) h++;
    return h;
  }

  let introRunning = false;
  function maybeIntro(h) {
    if (!me || introRunning) return;
    const key = "parful-intro-" + round.id + "-" + h;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) {}
    introRunning = true;
    let ch = isParty() ? challengeFor(round.code, h) : null;
    let idx = ch ? CHALLENGES.findIndex(c => c[0] === ch.text) : -1;
    let items;
    if (isCaddy()) {
      const pr0 = relevantPairs(me.group_no)[0];
      if (pr0) {
        idx = caddyCardIdx(round.code, pr0.caddy_id, pr0.golfer_id, h);
        ch = { text: CADDY_CARDS[idx].title, pts: 3, multi: true };
        items = CADDY_CARDS.map(cc => [cc.title, 3]);
      }
    }
    let message = null, color = me.color;
    if (isWolf()) {
      const st = wolfState(round, players, scores, picks, me.group_no);
      if (st.valid) { message = "🐺 " + st.holes[h].wolf.name + " is the Wolf"; color = st.holes[h].wolf.color; }
    }
    if (isMatch()) {
      const ms = matchState(round, players, scores, me.group_no);
      if (ms.valid) message = "⚔️ " + ms.holes[h].before;
    }
    if (isBbb()) message = "🎯 3 points up for grabs";
    if (isBest()) message = "🤝 Carry your partner";
    if (isVegas()) message = "🎰 Lowest number wins the difference";
    if (isSkins()) {
      const n = skinsState(round, players, scores).holes[h].pot;
      message = "💰 " + n + (n === 1 ? " skin" : " skins") + " on the line";
    }
    playHoleIntro({ hole: h, color, challenge: ch, idx, message, wolfGrab: isWolf(), coins: isSkins(), cartRun: isMatch(), bbb: isBbb(), carry: isBest(), slots: isVegas(), items }).then(() => { introRunning = false; });
  }

  function drawCard() {
    const myGroup = me ? me.group_no : 1;
    const isLeader = round.host_id === user.id || (!!me && me.is_co_leader);
    const mine = {};
    myScores().forEach(x => (mine[x.hole] = x.strokes));
    tabBtns.hole.textContent = "Hole " + hole;
    $("hole-label").textContent = "Hole " + hole;
    $("hole-mine").textContent = mine[hole] ? "You: " + (mine[hole] >= 11 ? "11+" : mine[hole]) : "No score yet";

    const strip = $("hole-strip");
    if (!strip.childElementCount) {
      for (let n = 1; n <= 18; n++) {
        const b = document.createElement("button");
        b.className = "hole-chip";
        b.dataset.h = n;
        b.innerHTML = "<span>" + n + "</span><small></small>";
        b.onclick = () => setHole(n);
        strip.append(b);
      }
    }
    const progNow = groupProgressHole();
    strip.querySelectorAll(".hole-chip").forEach(b => {
      const n = +b.dataset.h;
      const locked = n > progNow;
      b.disabled = locked;
      b.classList.toggle("locked", locked);
      b.querySelector("small").textContent = locked ? "🔒" : (mine[n] >= 11 ? "11+" : (mine[n] || ""));
      b.classList.toggle("done", mine[n] != null);
      b.classList.toggle("active", n === hole);
    });
    if (stripHole !== hole) {
      stripHole = hole;
      strip.querySelector(".active").scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }

    const grid = $("score-grid");
    if (!grid.childElementCount) {
      for (let n = 1; n <= 10; n++) {
        const b = document.createElement("button");
        b.textContent = n;
        b.dataset.s = n;
        b.onclick = () => saveScore(n);
        grid.append(b);
      }
      const max = document.createElement("button");
      max.className = "score-max";
      max.dataset.s = 11;
      max.innerHTML = "<span>11+</span><small>You can't be serious</small>";
      max.onclick = () => saveScore(11);
      grid.append(max);
    }
    const target = keeperTarget(myGroup);
    const tScore = (scores.find(x => x.player_id === target.id && x.hole === hole) || {}).strokes;
    grid.querySelectorAll("button").forEach(b => b.classList.toggle("selected", +b.dataset.s === tScore));
    renderKeeperRow(myGroup, target);
    $("score-label").textContent = target.id === me.id ? "Your score" : target.name + "'s score";
    const missing = players.filter(p => p.group_no === myGroup && p.role !== "caddy")
      .filter(p => !scores.some(x => x.player_id === p.id && x.hole === hole && x.strokes));
    $("waiting-on").textContent = mine[hole] && missing.length ? "Waiting on " + missing.map(p => p.name).join(", ") : "";

    $("wolf-box").style.display = isWolf() ? "block" : "none";
    $("skins-box").style.display = isSkins() ? "block" : "none";
    $("match-box").style.display = isMatch() ? "block" : "none";
    $("caddy-box").style.display = isCaddy() ? "block" : "none";
    if (isCaddy()) drawCaddy(myGroup, isLeader);
    $("bbb-box").style.display = isBbb() ? "block" : "none";
    if (isBbb()) drawBbb(myGroup, isLeader);
    $("best-box").style.display = isBest() ? "block" : "none";
    if (isBest()) drawBest(myGroup);
    $("vegas-box").style.display = isVegas() ? "block" : "none";
    if (isVegas()) drawVegas(myGroup);
    const hideGrid = isCaddy() && !!me && me.role === "caddy" && !(keeperMode && canKeep());
    $("score-grid").style.display = hideGrid ? "none" : "";
    $("score-label").style.display = hideGrid ? "none" : "";
    if (isMatch()) drawMatch();
    if (isSkins()) drawSkins();
    if (isWolf()) drawWolf(myGroup, isLeader);
    $("ch-box").style.display = isParty() ? "block" : "none";
    if (!isParty()) return;
    const ch = challengeFor(round.code, hole);
    $("ch-text").textContent = ch.multi ? ch.text : ch.text + " (" + (ch.pts > 0 ? "+" : "") + ch.pts + ")";
    const resAll = results.filter(r => r.hole === hole && r.group_no === myGroup);
    const res = resAll[0];
    const winner = res && players.find(pl => pl.id === res.winner_id);
    const winnerNames = resAll.map(r => (players.find(pl => pl.id === r.winner_id) || {}).name).filter(Boolean);
    $("ch-winner").textContent = ch.multi
      ? (winnerNames.length ? "Pulled it off: " + winnerNames.join(", ")
        : (isLeader ? "Tap everyone who pulled it off" : "Your group's leader marks who pulled it off"))
      : winner
      ? (ch.pts > 0 ? "Won by " : "Stuck with it: ") + winner.name
      : (isLeader ? "Tap who " + (ch.pts > 0 ? "won it" : "gets it") : "Your group's leader picks the winner");
    const pick = $("ch-pick");
    pick.style.display = isLeader ? "flex" : "none";
    pick.innerHTML = "";
    if (isLeader) {
      players.filter(pl => pl.group_no === myGroup).forEach(pl => {
        const b = document.createElement("button");
        b.append(figureEl(pl.color), pl.name);
        b.classList.toggle("selected", resAll.some(r => r.winner_id === pl.id));
        b.onclick = () => awardChallenge(pl.id, ch.multi);
        pick.append(b);
      });
    }
  }

  function drawMatch() {
    const ms = matchState(round, players, scores, me ? me.group_no : 1);
    if (!ms.valid) {
      $("match-status").textContent = "Match Play needs at least 2 players in your group.";
      $("match-result").textContent = "";
      return;
    }
    const info = ms.holes[hole];
    $("match-status").textContent = "⚔️ " + info.before;
    $("match-result").textContent = info.result
      ? info.result + (ms.clinched ? " Final: " + ms.status + "." : "")
      : "Lower score wins the hole. Same score and it's halved.";
  }

  function relevantPairs(g) {
    const isLead = round.host_id === user.id || (!!me && me.is_co_leader);
    return pairs.filter(pr => {
      const cd = players.find(p => p.id === pr.caddy_id);
      if (!cd || cd.group_no !== g) return false;
      return isLead || (!!me && (me.id === pr.caddy_id || me.id === pr.golfer_id));
    });
  }

  function inputFor(card, opts, onPick, btnLabel, placeholder) {
    if (opts) {
      const row = document.createElement("div");
      row.className = "chip-row";
      opts.forEach(o => {
        const [v, label] = Array.isArray(o) ? o : [o, o];
        const b = document.createElement("button");
        b.textContent = label;
        b.onclick = () => onPick(v);
        row.append(b);
      });
      return row;
    }
    const row = document.createElement("form");
    row.className = "cp-row";
    const inp = document.createElement("input");
    inp.placeholder = placeholder;
    if (card.type === "number") { inp.type = "number"; inp.inputMode = "numeric"; } else inp.maxLength = 200;
    const b = document.createElement("button");
    b.type = "submit";
    b.textContent = btnLabel;
    row.onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); if (v) onPick(v); };
    row.append(inp, b);
    return row;
  }

  function drawCaddy(g, isLeader) {
    const box = $("caddy-box");
    if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    box.innerHTML = "";
    if (me && me.role === "caddy") $("hole-mine").textContent = "Caddying";
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const list = relevantPairs(g);
    if (!list.length) { box.append(mk("p", "waiting", "No caddy calls for you on this hole. Just golf.")); return; }
    list.forEach(pr => {
      const cd = players.find(p => p.id === pr.caddy_id), gf = players.find(p => p.id === pr.golfer_id);
      if (!cd || !gf) return;
      const card = CADDY_CARDS[caddyCardIdx(round.code, cd.id, gf.id, hole)];
      const pred = preds.find(x => x.caddy_id === cd.id && x.golfer_id === gf.id && x.hole === hole);
      const canCall = isLeader || (!!me && me.id === cd.id);
      const canJudge = isLeader || (!!me && me.id === gf.id);
      const sec = mk("div", "caddy-pair");
      const head = mk("div", "cp-head");
      head.append(figureEl(cd.color, 14), cd.name + " caddying for ", figureEl(gf.color, 14), gf.name);
      sec.append(head, mk("div", "cp-title", card.title), mk("p", "cp-prompt", card.prompt.replace("{g}", gf.name)));
      if (!pred) {
        if (canCall) sec.append(inputFor(card, card.options, v => makeCall(pr, card, v), "Lock it in", card.type === "number" ? "Yards" : "Your prediction"));
        else sec.append(mk("p", "cp-note", "Waiting on " + cd.name + " to make the call."));
      } else {
        sec.append(mk("p", "cp-note", cd.name + "'s call: " + caddyGuessText(pred.kind, pred.guess)));
        if (pred.outcome == null) {
          if (canJudge) {
            sec.append(mk("p", "cp-note", "What happened?"));
            const opts = card.type === "choice" ? card.options : card.type === "text" ? [["yes", "It happened"], ["no", "Nope"]] : null;
            sec.append(inputFor(card, opts, v => judge(pred, cd, gf, v), "Save", "Actual yards"));
          } else sec.append(mk("p", "cp-note", "Waiting on " + gf.name + " to say what happened."));
        } else {
          const pts = pred.points;
          sec.append(mk("p", "cp-result", pts === 3 ? "Called it! +3" : pts === 1 ? "Close enough. +1" : "Missed. No points."));
        }
      }
      if (canCall) {
        const lo = hole <= 9 ? 1 : 10, hi = lo + 8;
        const used = mulls.find(m => m.caddy_id === cd.id && m.golfer_id === gf.id && m.hole >= lo && m.hole <= hi);
        const row = mk("div", "cp-mull");
        if (used && used.hole === hole) {
          const b = mk("button", "mini selected", "Mulligan granted (-2). Take it back");
          b.onclick = () => toggleMulligan(cd, gf, true);
          row.append(b);
        } else if (!used) {
          const b = mk("button", "mini", "Grant " + gf.name + " a mulligan (-2)");
          b.onclick = () => toggleMulligan(cd, gf, false);
          row.append(b);
        } else row.append(mk("span", "cp-note", "Mulligan used on hole " + used.hole + (lo === 1 ? ". Next one opens on the back 9." : ".")));
        sec.append(row);
      }
      box.append(sec);
    });
  }

  async function makeCall(pr, card, v) {
    if (card.type === "number") {
      const n = parseInt(v, 10);
      if (!(n > 0 && n < 500)) { toast("Enter yards between 1 and 499."); return; }
      v = String(n);
    }
    const { error } = await db.from("predictions").insert({
      round_id: round.id, hole, caddy_id: pr.caddy_id, golfer_id: pr.golfer_id, kind: card.key, guess: String(v).slice(0, 200) });
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function judge(pred, cd, gf, v) {
    if (pred.kind === "distance") {
      const n = parseInt(v, 10);
      if (!(n >= 0 && n < 500)) { toast("Enter yards between 0 and 499."); return; }
      v = String(n);
    }
    const pts = caddyPointsFor(pred.kind, pred.guess, v);
    const { error } = await db.from("predictions").update({ outcome: String(v), points: pts }).eq("id", pred.id);
    if (error) { toast(error.message); return; }
    const call = caddyGuessText(pred.kind, pred.guess);
    const line = pred.kind === "distance"
      ? "🏌️ " + cd.name + " guessed " + pred.guess + " yards. " + gf.name + " hit it " + v + ". " + (pts ? "+" + pts + " Caddy Points" : "Not even close.")
      : pts ? "🏌️ " + cd.name + " called " + call + ". " + gf.name + " delivered. +" + pts + " Caddy Points"
      : "🏌️ " + cd.name + " called " + call + ". " + gf.name + " had other plans. No points.";
    db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto", body: line.slice(0, 280) }).then(() => {});
    refresh();
  }

  async function toggleMulligan(cd, gf, on) {
    const { error } = on
      ? await db.from("mulligans").delete().eq("caddy_id", cd.id).eq("golfer_id", gf.id).eq("hole", hole)
      : await db.from("mulligans").insert({ round_id: round.id, caddy_id: cd.id, golfer_id: gf.id, hole });
    if (error) { toast(error.message); return; }
    if (!on) db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto",
      body: "⛳ " + cd.name + " granted " + gf.name + " a mulligan. That'll cost " + cd.name + " 2 points." }).then(() => {});
    refresh();
  }

  function renderCaddyBoard() {
    const allow = holeAllowances(round, players);
    const cpts = caddyTotals(preds, mulls);
    board.innerHTML = "";
    const head = (text) => { const li = document.createElement("li"); li.className = "group-head"; li.textContent = text; board.append(li); };
    const row = (pl, label, i) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.append((i + 1) + ". ", figureEl(pl.color), pl.name + (pl.user_id === user.id ? " (you)" : ""));
      const val = document.createElement("span");
      val.textContent = label;
      li.append(name, val);
      board.append(li);
    };
    head("Caddies");
    players.filter(p => p.role === "caddy").sort((a, b) => (cpts[b.id] || 0) - (cpts[a.id] || 0))
      .forEach((pl, i) => row(pl, (cpts[pl.id] || 0) + " pts", i));
    head("Golfers");
    players.filter(p => p.role !== "caddy").map(pl => {
      const mine = scores.filter(x => x.player_id === pl.id && x.strokes);
      const total = mine.reduce((a, x) => a + x.strokes, 0);
      return { pl, total, net: total - (allow[pl.id] || 0) * mine.length, thru: mine.length };
    }).sort((a, b) => (a.thru ? a.net / a.thru : Infinity) - (b.thru ? b.net / b.thru : Infinity))
      .forEach((r, i) => row(r.pl, r.thru ? r.total + " strokes" + (round.handicap ? ", net " + Math.round(r.net) : "") + " (thru " + r.thru + ")" : "-", i));
  }

  function drawVegas(g) {
    const st = vegasState(round, players, scores, g);
    if (!st.valid) {
      $("vegas-teams").textContent = "Vegas needs 4 players split 2 and 2.";
      $("vegas-result").textContent = "";
      return;
    }
    const nm = arr => arr.map(p => p.name).join(" + ");
    $("vegas-teams").textContent = TEAM_NAMES[1] + ": " + nm(st.teams[1]) + " vs " + TEAM_NAMES[2] + ": " + nm(st.teams[2]);
    const hi = st.holes[hole];
    if (!hi) { $("vegas-result").textContent = "Your team's two scores become one number. Lowest number wins the difference."; return; }
    const show = k => hi.num[k] + " (" + hi.parts[k].slice().sort((x, y) => x - y).join(" + ") + ")";
    $("vegas-result").textContent = hi.winner
      ? TEAM_NAMES[1] + " " + show(1) + ", " + TEAM_NAMES[2] + " " + show(2) + ". " + TEAM_NAMES[hi.winner] + " wins by " + hi.diff + ", +" + hi.diff + " each."
      : "Both teams made " + hi.num[1] + ". Push.";
  }

  function drawBest(g) {
    const st = bestBallState(round, players, scores, g);
    if (!st.valid) {
      $("best-teams").textContent = "Best Ball needs 4 players split 2 and 2.";
      $("best-result").textContent = "";
      return;
    }
    const nm = arr => arr.map(p => p.name).join(" + ");
    $("best-teams").textContent = TEAM_NAMES[1] + ": " + nm(st.teams[1]) + " vs " + TEAM_NAMES[2] + ": " + nm(st.teams[2]);
    const hi = st.holes[hole];
    $("best-result").textContent = !hi ? "Lowest score on each team counts." + (round.handicap ? " Handicaps apply." : "")
      : hi.winner ? TEAM_NAMES[hi.winner] + " takes it, " + hi.best[hi.winner] + " to " + hi.best[3 - hi.winner] + ". +1 each."
      : "Tie at " + hi.best[1] + ". No points.";
  }

  const BBB = [
    ["bingo", "Bingo", "First ball on the green."],
    ["bango", "Bango", "Closest to the pin once everyone's on the green."],
    ["bongo", "Bongo", "First ball in the cup."],
  ];

  function drawBbb(g, isLeader) {
    const box = $("bbb-rows");
    box.innerHTML = "";
    BBB.forEach(([k, title, desc]) => {
      const res = results.find(x => x.hole === hole && x.group_no === g && x.award === k);
      const w = res && players.find(p => p.id === res.winner_id);
      const sec = document.createElement("div");
      sec.className = "bbb-row";
      const tt = document.createElement("div");
      tt.className = "cp-title";
      tt.textContent = title + (w ? ": " + w.name : "");
      const d = document.createElement("div");
      d.className = "cp-note";
      d.textContent = desc;
      sec.append(tt, d);
      if (isLeader) {
        const row = document.createElement("div");
        row.className = "chip-row";
        players.filter(p => p.group_no === g).forEach(p => {
          const same = !!w && w.id === p.id;
          const b = document.createElement("button");
          b.append(figureEl(p.color), p.name);
          b.classList.toggle("selected", same);
          b.onclick = () => awardBbb(k, p.id, same);
          row.append(b);
        });
        sec.append(row);
      }
      box.append(sec);
    });
    if (!isLeader) {
      const n = document.createElement("p");
      n.className = "cp-note";
      n.textContent = "Your group's leader taps the winners.";
      box.append(n);
    }
  }

  async function awardBbb(k, pid, isSame) {
    const g = me ? me.group_no : 1;
    const del = await db.from("challenge_results").delete().eq("round_id", round.id).eq("hole", hole).eq("group_no", g).eq("award", k);
    if (del.error) { toast(del.error.message); return; }
    if (!isSame) {
      const { error } = await db.from("challenge_results").insert({ round_id: round.id, hole, group_no: g, winner_id: pid, points: 1, award: k });
      if (error) { toast(error.message); return; }
    }
    refresh();
  }

  function renderBets() {
    const isHost = round.host_id === user.id;
    const canSettle = isHost || (!!me && me.is_co_leader);
    const byId = id => players.find(pl => pl.id === id);
    const chip = (label, onclick, selected, color) => {
      const b = document.createElement("button");
      b.type = "button";
      if (color !== undefined) b.append(figureEl(color));
      b.append(label);
      b.classList.toggle("selected", !!selected);
      b.onclick = onclick;
      return b;
    };

    const forRow = $("bet-for");
    forRow.innerHTML = "";
    if (isHost && players.length > 1) {
      if (!betPoster && me) betPoster = me.id;
      const lbl = document.createElement("span");
      lbl.className = "cp-note";
      lbl.style.width = "100%";
      lbl.textContent = "Posting for:";
      forRow.append(lbl);
      players.forEach(pl => forRow.append(chip(pl.name, () => { betPoster = pl.id; renderBets(); }, pl.id === betPoster, pl.color)));
    }

    betList.innerHTML = "";
    if (!bets.length) {
      const e = document.createElement("p");
      e.className = "waiting";
      e.textContent = "No side bets yet. Somebody put money where their mouth is.";
      betList.append(e);
      return;
    }
    bets.slice().reverse().forEach(b => {
      const cr = byId(b.creator_id), tk = byId(b.taker_id);
      if (!cr) return;
      const amt = moneyFmt(b.amount);
      const card = document.createElement("div");
      card.className = "bet-card";
      const top = document.createElement("div");
      top.className = "bet-top";
      top.append(figureEl(cr.color), cr.name + " bets " + amt);
      const body = document.createElement("div");
      body.className = "bet-body";
      body.textContent = "\u201C" + b.body + "\u201D";
      const status = document.createElement("div");
      status.className = "cp-note";
      const actions = document.createElement("div");
      actions.className = "chip-row";
      if (!b.taker_id) {
        status.textContent = "Open. Waiting for someone to take it.";
        if (isHost) players.filter(pl => pl.id !== cr.id).forEach(pl => actions.append(chip("Taken by " + pl.name, () => takeBet(b, pl), false, pl.color)));
        else if (me && me.id !== cr.id) actions.append(chip("Take it", () => takeBet(b, me)));
        if (isHost || (me && me.id === cr.id)) actions.append(chip("Cancel", () => cancelBet(b)));
      } else if (!b.outcome) {
        status.textContent = cr.name + " vs " + (tk ? tk.name : "?") + " for " + amt + ". " + cr.name + " wins if it happens.";
        if (canSettle) {
          actions.append(chip("It happened", () => resolveBet(b, "creator")), chip("Didn't happen", () => resolveBet(b, "taker")), chip("Push", () => resolveBet(b, "push")));
        } else {
          const n = document.createElement("span");
          n.className = "cp-note";
          n.textContent = "The party leader settles it.";
          actions.append(n);
        }
      } else if (b.outcome === "push") {
        status.textContent = "Push. Nobody pays.";
      } else {
        const w = b.outcome === "creator" ? cr : tk, l = b.outcome === "creator" ? tk : cr;
        status.textContent = (w ? w.name : "?") + " won " + amt + " off " + (l ? l.name : "?") + ".";
      }
      card.append(top, body, status, actions);
      betList.append(card);
    });
  }

  async function takeBet(b, pl) {
    const { error } = await db.from("bets").update({ taker_id: pl.id }).eq("id", b.id).is("taker_id", null);
    if (error) { toast(error.message); return; }
    const cr = players.find(x => x.id === b.creator_id);
    betChat("🤝 " + pl.name + " took " + (cr ? cr.name + "'s " : "the ") + moneyFmt(b.amount) + " bet: \u201C" + b.body + "\u201D");
    refresh();
  }

  async function cancelBet(b) {
    const { error } = await db.from("bets").delete().eq("id", b.id);
    if (error) { toast(error.message); return; }
    refresh();
  }

  async function resolveBet(b, outcome) {
    const { error } = await db.from("bets").update({ outcome }).eq("id", b.id);
    if (error) { toast(error.message); return; }
    const cr = players.find(x => x.id === b.creator_id), tk = players.find(x => x.id === b.taker_id);
    if (outcome === "push") betChat("🤷 Push on \u201C" + b.body + "\u201D. Nobody pays.");
    else {
      const w = outcome === "creator" ? cr : tk, l = outcome === "creator" ? tk : cr;
      betChat("💰 " + (w ? w.name : "?") + " won " + moneyFmt(b.amount) + " off " + (l ? l.name : "?") + ": \u201C" + b.body + "\u201D");
    }
    refresh();
  }

  function drawSkins() {
    const info = skinsState(round, players, scores).holes[hole];
    const n = info.pot, word = n === 1 ? " skin" : " skins";
    $("skins-pot").textContent = "💰 " + n + word + " on this hole";
    $("skins-result").textContent = info.result === "won" ? info.winner.name + " took " + n + word + "."
      : info.result === "carry" ? (hole === 18 ? "Tie on 18. Those skins go unclaimed." : "Tie. " + (n === 1 ? "The skin carries" : "All " + n + " skins carry") + " to the next hole.")
      : "Lowest score alone takes it. Tie, and it carries over.";
  }

  function drawWolf(g, isLeader) {
    const st = wolfState(round, players, scores, picks, g);
    const box = $("wolf-pick");
    box.innerHTML = "";
    if (!st.valid) {
      $("wolf-name").textContent = "Wolf needs 3 or 4 players in your group.";
      $("wolf-tee").textContent = "";
      $("wolf-teams").textContent = "";
      box.style.display = "none";
      return;
    }
    const info = st.holes[hole];
    const byId = id => players.find(p => p.id === id);
    const nm = id => (byId(id) ? byId(id).name : "?");
    $("wolf-name").textContent = "🐺 " + info.wolf.name + (hole >= 17 && info.tee.length === 4 ? " (last place gets the Wolf)" : "");
    $("wolf-tee").textContent = "Tee order: " + info.tee.map(p => p.name).join(", ");
    const pick = info.pick;
    const iAmWolf = !!me && me.id === info.wolf.id;
    let teams = iAmWolf ? "Pick your partner."
      : isLeader ? "Pick a partner for " + info.wolf.name + "."
      : "Waiting on " + info.wolf.name + " to pick a partner.";
    if (pick) teams = pick.kind === "partner"
      ? nm(pick.wolf_id) + " + " + nm(pick.partner_id) + " vs " + info.tee.filter(p => p.id !== pick.wolf_id && p.id !== pick.partner_id).map(p => p.name).join(" + ")
      : (pick.kind === "blind" ? "Blind Wolf! " : "Lone Wolf! ") + nm(pick.wolf_id) + " vs everyone";
    const r = info.result;
    if (r) teams = (pick ? teams + ". " : "") + (r.kind === "push" ? "Push, no points."
      : r.kind === "nopick" ? "No pick was made, so the hole pushed."
      : r.ids.map(nm).join(" + ") + " won it, +" + r.pts + (r.ids.length > 1 ? " each." : "."));
    $("wolf-teams").textContent = teams;
    const canPick = !r && !!me && (me.id === info.wolf.id || isLeader);
    box.style.display = canPick ? "flex" : "none";
    if (!canPick) return;
    info.tee.filter(p => p.id !== info.wolf.id).forEach(p => {
      const b = document.createElement("button");
      b.append(figureEl(p.color), p.name);
      b.classList.toggle("selected", !!pick && pick.kind === "partner" && pick.partner_id === p.id);
      b.onclick = () => saveWolfPick(g, info.wolf.id, "partner", p.id);
      box.append(b);
    });
    [["lone", "Lone Wolf"], ["blind", "Blind Wolf"]].forEach(([k, label]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.classList.toggle("selected", !!pick && pick.kind === k);
      b.onclick = () => saveWolfPick(g, info.wolf.id, k, null);
      box.append(b);
    });
  }

  async function saveWolfPick(g, wolfId, kind, partnerId) {
    const { error } = await db.from("wolf_picks").upsert(
      { round_id: round.id, group_no: g, hole, wolf_id: wolfId, partner_id: partnerId, kind },
      { onConflict: "round_id,group_no,hole" });
    if (error) { toast(error.message); return; }
    refresh();
  }

  function keeperTarget(g) {
    if (!(keeperMode && me && canKeep())) return me;
    const group = players.filter(p => p.group_no === g && p.role !== "caddy");
    let t = group.find(p => p.id === scoringFor);
    if (!t) t = group.find(p => !scores.some(x => x.player_id === p.id && x.hole === hole && x.strokes)) || group[0] || me;
    scoringFor = t.id;
    return t;
  }

  function renderKeeperRow(g, target) {
    const row = $("keeper-row");
    const on = keeperMode && canKeep();
    row.style.display = on ? "flex" : "none";
    row.innerHTML = "";
    if (!on) return;
    players.filter(p => p.group_no === g && p.role !== "caddy").forEach(p => {
      const sc = (scores.find(x => x.player_id === p.id && x.hole === hole) || {}).strokes;
      const b = document.createElement("button");
      b.append(figureEl(p.color), p.name + (sc ? ": " + (sc >= 11 ? "11+" : sc) : ""));
      b.classList.toggle("selected", p.id === target.id);
      b.onclick = () => { scoringFor = p.id; drawCard(); };
      row.append(b);
    });
  }

  async function saveScore(n) {
    const h = hole;
    const target = keeperTarget(me ? me.group_no : 1);
    const prev = (scores.find(x => x.player_id === target.id && x.hole === h) || {}).strokes;
    const { error } = await db.from("scores").upsert(
      { round_id: round.id, player_id: target.id, hole: h, strokes: n },
      { onConflict: "player_id,hole" });
    if (error) { toast("Error: " + error.message); return; }
    Sound.play(n === 1 ? "ace" : n >= 8 ? "sad" : "pop");
    if (n !== prev) {
      const line = scoreLine(target.name, n, h);
      if (line) db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto", body: line }).then(() => {});
    }
    if (keeperMode) scoringFor = null;
    refresh();
  }

  async function awardChallenge(playerId, multi) {
    const ch = challengeFor(round.code, hole);
    const g = me ? me.group_no : 1;
    const mine = results.filter(r => r.hole === hole && r.group_no === g);
    let error;
    if (multi) {
      const existing = mine.find(r => r.winner_id === playerId);
      ({ error } = existing
        ? await db.from("challenge_results").delete().eq("id", existing.id)
        : await db.from("challenge_results").insert({ round_id: round.id, hole, winner_id: playerId, points: ch.pts, group_no: g }));
    } else {
      if (mine.length === 1 && mine[0].winner_id === playerId) return;
      const del = await db.from("challenge_results").delete().eq("round_id", round.id).eq("hole", hole).eq("group_no", g);
      if (del.error) { toast(del.error.message); return; }
      ({ error } = await db.from("challenge_results").insert({ round_id: round.id, hole, winner_id: playerId, points: ch.pts, group_no: g }));
    }
    if (error) { toast("Error: " + error.message); return; }
    refresh();
  }

  async function rejoin() {
    const choice = await pickFrom("Which one is you?", players.map(pl => ({ label: pl.name, value: pl, color: pl.color })));
    if (!choice) return;
    const { error } = await db.rpc("claim_player", { p_player_id: choice.id });
    if (error) { toast(error.message); return; }
    cardReady = false;
    refresh();
  }

  async function doJoin() {
    const vals = await ask("Join " + round.name, [
      { label: "Your name", placeholder: "What the boys call you", max: 20 },
      { label: "Pick your stick figure", type: "colors", taken: players.map(p => p.color) },
      ...(round.handicap ? [{ label: "What do you usually shoot for 18?", type: "number", placeholder: "e.g. 95", max: 3 }] : [])
    ], "I'm in", null, async (v) => (round.handicap && !validUsual(v[2]) ? "Enter your usual score for 18 holes (40 to 200)." : null));
    if (!vals) return;
    const { data: { session } } = await db.auth.getSession();
    if (!session) { userPromise = null; await ensureUser(); }
    const { error } = await db.from("players").insert({ round_id: round.id, name: vals[0], color: vals[1] === "-" ? null : vals[1], usual_score: round.handicap ? parseInt(vals[2], 10) : null });
    if (error && error.code === "23505") { toast("Someone just grabbed that color. Pick another."); refresh(); return; }
    if (error) { toast("Error: " + error.message); return; }
    refresh();
  }
  join.onclick = doJoin;
  lateJoin.onclick = rejoin;

  await refresh();
  loadMessages();
  const live = { schema: "public" };
  db.channel("round-" + round.id)
    .on("postgres_changes", { ...live, event: "*", table: "players", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "scores", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "challenge_results", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "UPDATE", table: "rounds", filter: "id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "bets", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "caddy_pairs", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "predictions", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "mulligans", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "wolf_picks", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "INSERT", table: "messages", filter: "round_id=eq." + round.id }, (payload) => onMessage(payload.new))
    .subscribe();
}

const roundCode = new URLSearchParams(location.search).get("r");
if (!roundCode && !location.search) {
  const sb = soundButton();
  sb.classList.add("sound-home");
  document.body.append(sb);
  Sound.music(true);
}
if (roundCode) loadRound(roundCode);
else ensureUser()
  .then(() => { $("status").textContent = ""; renderAccount(); })
  .catch(err => { $("status").textContent = "Error: " + err.message; });

$("join-code").onclick = async () => {
  const vals = await ask("Join a round", [
    { label: "Round code", placeholder: "AB12CD", max: 6, upper: true }
  ], "Let's go");
  if (vals) location.href = "/?r=" + vals[0].toUpperCase();
};

const QUIPS = [
  "Mulligans are a sign of weakness. Take one anyway.",
  "Losers buy the first round.",
  "Your swing thoughts are not welcome here.",
  "No gimmes. Okay, some gimmes.",
  "Whoever finds the most sand is paying.",
  "Your handicap called. It wants a bigger number.",
  "What happens on the course gets screenshotted.",
];
$("quip").textContent = QUIPS[Math.floor(Math.random() * QUIPS.length)];

function linkBtn(text, onclick) {
  const b = document.createElement("button");
  b.className = "link-btn";
  b.textContent = text;
  b.onclick = onclick;
  return b;
}

async function renderAccount() {
  const el = $("account");
  if (!el) return;
  const { data: { session } } = await db.auth.getSession();
  const u = session && session.user;
  el.innerHTML = "";
  if (u && !u.is_anonymous) {
    const who = document.createElement("span");
    who.textContent = "Signed in as " + u.email;
    el.append(who, linkBtn("Sign out", signOut));
  } else {
    el.append(linkBtn("Create account", createAccount), linkBtn("Sign in", signIn));
  }
}

const authFields = [
  { label: "Email", type: "email", placeholder: "you@example.com", max: 120 },
  { label: "Password", type: "password", placeholder: "At least 6 characters", max: 72 },
];

function friendlyAuthError(err) {
  const m = ((err && err.message) || "").toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Try again.";
  if (m.includes("already")) return "That email already has an account. Sign in instead.";
  if (m.includes("password")) return "Password needs at least 6 characters.";
  if (m.includes("email")) return "That doesn't look like a valid email address.";
  return (err && err.message) || "Something went wrong. Try again.";
}

async function createAccount() {
  const vals = await ask("Create your account", authFields, "Create account", null, async ([email, password]) => {
    if (password.length < 6) return "Password needs at least 6 characters.";
    try {
      await ensureUser();
      const r1 = await db.auth.updateUser({ email });
      if (r1.error) throw r1.error;
      const r2 = await db.auth.updateUser({ password });
      if (r2.error) throw r2.error;
      return null;
    } catch (e) { return friendlyAuthError(e); }
  });
  if (vals) renderAccount();
}

async function signIn() {
  const vals = await ask("Sign in", authFields, "Sign in", null, async ([email, password]) => {
    const { error } = await db.auth.signInWithPassword({ email, password });
    return error ? friendlyAuthError(error) : null;
  });
  if (!vals) return;
  userPromise = null;
  renderAccount();
}

async function signOut() {
  await db.auth.signOut();
  userPromise = null;
  renderAccount();
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "alert");
  t.textContent = String(msg).replace(/^Error: /, "");
  document.body.append(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3600);
}
