const $ = (id) => document.getElementById(id);

const PALETTE = [
  ["#5CE1FF", "Cyan"], ["#FF5C7A", "Red"], ["#FFD84D", "Yellow"], ["#7CFF6B", "Lime"], ["#B57BFF", "Purple"],
  ["#FF9F43", "Orange"], ["#FF7AE0", "Pink"], ["#4D8BFF", "Blue"], ["#FFFFFF", "White"], ["#3DDBB0", "Teal"],
];

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
    b.append(figureEl(hex, 30));
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

function ask(title, fields, confirmText, note, onSubmit) {
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
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = f.label;
      const input = document.createElement("input");
      input.placeholder = f.placeholder || "";
      input.maxLength = f.max || 40;
      input.autocomplete = "off";
      if (f.type) input.type = f.type;
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
];

function challengeFor(code, hole) {
  let seed = 0;
  for (const c of code) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const order = CHALLENGES.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const [text, pts] = CHALLENGES[order[(hole - 1) % order.length]];
  return { text, pts };
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
    { label: "Pick your stick figure", type: "colors" }
  ], "Tee it up");
  if (!vals) return;
  const [roundName, playerName, color] = vals;
  try {
    await ensureUser();
    const { data: round, error: e1 } = await db.from("rounds")
      .insert({ name: roundName.trim() }).select().single();
    if (e1) throw e1;
    const { error: e2 } = await db.from("players")
      .insert({ round_id: round.id, name: playerName.trim(), color: color === "-" ? null : color });
    if (e2) throw e2;
    location.href = "/?r=" + round.code;
  } catch (err) {
    $("status").textContent = "Error: " + err.message;
  }
});

const MODES = {
  party: { name: "Party Mode", desc: "Points every hole plus a random challenge card. Bonuses, curses, and bragging rights." },
  stroke: { name: "Stroke Play", desc: "Regular golf rules, lowkey boring but so is your personality." },
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

  let me = null, players = [], scores = [], results = [];
  let hole = 1, strokes = 4, cardReady = false, pickedMode = null;
  const isParty = () => round.mode !== "stroke";
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
  autoBtn.textContent = "Auto-split into foursomes";
  autoBtn.style.cssText = "width:100%;margin-top:10px";
  autoBtn.onclick = () => autoSplit();
  groupTools.append(groupHint, autoBtn);

  const rejoinBtn = document.createElement("button");
  rejoinBtn.className = "link-btn";
  rejoinBtn.textContent = "I'm already in this round";
  rejoinBtn.onclick = () => rejoin();
  lobby.append(linkRow, share, h3("Who's in"), lobbyList, groupTools, join, rejoinBtn, hostArea, waiting);

  if (round.host_id === user.id) {
    waiting.style.display = "none";
    const startBtn = document.createElement("button");
    startBtn.textContent = "Pick a mode to start";
    startBtn.disabled = true;
    startBtn.style.width = "100%";
    hostArea.append(h3("Pick a game mode"));
    Object.entries(MODES).forEach(([key, m]) => {
      const tile = document.createElement("button");
      tile.className = "mode-tile";
      const b = document.createElement("b");
      b.textContent = m.name;
      const d = document.createElement("span");
      d.textContent = m.desc;
      tile.append(b, d);
      tile.onclick = () => {
        pickedMode = key;
        hostArea.querySelectorAll(".mode-tile").forEach(t => t.classList.toggle("selected", t === tile));
        startBtn.disabled = false;
        startBtn.textContent = "Start game";
      };
      hostArea.append(tile);
    });
    startBtn.onclick = async () => {
      if (!pickedMode) return;
      const yes = await ask("Start the game?", [], "Let's play", "No one can join the round once the game has begun.");
      if (!yes) return;
      startBtn.disabled = true;
      const { error } = await db.from("rounds").update({ status: "playing", mode: pickedMode }).eq("id", round.id);
      if (error) { toast("Error: " + error.message); startBtn.disabled = false; return; }
      refresh();
    };
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
    <div class="score-label">Your score</div>
    <div id="score-grid" class="score-grid"></div>`;

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
  [["hole", "Hole 1"], ["board", "Leaderboard"], ["chat", "Chat"]].forEach(([key, label]) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.textContent = label;
    b.onclick = () => showTab(key);
    tabs.append(b);
    tabBtns[key] = b;
    panels[key] = document.createElement("div");
  });
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
  panels.board.append(board);
  const chatSoon = document.createElement("p");
  chatSoon.className = "waiting";
  chatSoon.textContent = "Trash talk loading. Chat is coming soon.";
  panels.chat.append(chatSoon);
  function showTab(key) {
    Object.entries(panels).forEach(([k, el]) => (el.style.display = k === key ? "block" : "none"));
    Object.entries(tabBtns).forEach(([k, b]) => b.classList.toggle("active", k === key));
  }
  game.append(lateWrap, tabs, panels.hole, panels.board, panels.chat);
  showTab("hole");
  const scoreArea = document.createElement("div");
  scoreArea.style.display = "none";
  box.append(lobby, game, scoreArea);

  function renderLobbyList() {
    const isLeader = round.host_id === user.id;
    const tournament = players.length > 4 || players.some(p => p.group_no > 1);
    const groupCount = Math.max(1, Math.ceil(players.length / 4), ...players.map(p => p.group_no));
    groupTools.style.display = isLeader && players.length > 4 ? "block" : "none";
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
          + (pl.user_id === user.id ? " (you)" : "");
        name.prepend(figureEl(pl.color));
        li.append(name);
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
    const res = await Promise.all(players.map((pl, i) =>
      db.from("players").update({ group_no: Math.floor(i / 4) + 1, is_co_leader: false }).eq("id", pl.id)));
    const bad = res.find(r => r.error);
    if (bad) toast(bad.error.message);
    refresh();
  }

  // ---------- Data + render ----------
  async function refresh() {
    const [r, p, sc, c] = await Promise.all([
      fetchRound(),
      db.from("players").select("*").eq("round_id", round.id).order("created_at"),
      db.from("scores").select("*").eq("round_id", round.id),
      db.from("challenge_results").select("*").eq("round_id", round.id),
    ]);
    if (r.data) round = r.data;
    players = p.data || [];
    scores = sc.data || [];
    results = c.data || [];
    me = players.find(pl => pl.user_id === user.id) || null;
    render();
  }

  function render() {
    const playing = round.status === "playing";
    const finished = round.status === "finished";
    lobby.style.display = round.status === "lobby" ? "block" : "none";
    game.style.display = playing ? "block" : "none";
    scoreArea.style.display = finished ? "block" : "none";
    if (finished) renderScorecard(scoreArea, { round, players, scores, results, user });
    sub.textContent = finished ? "Final results" : playing
      ? (MODES[round.mode] || MODES.party).name
      : "Round code: " + round.code;
    renderLobbyList();
    join.style.display = me ? "none" : "block";
    rejoinBtn.style.display = !me && players.length ? "inline-block" : "none";
    if (playing) renderGame();
  }

  function renderGame() {
    const played = scores.filter(x => x.strokes);
    const rows = players.map(pl => {
      const mine = played.filter(x => x.player_id === pl.id);
      const total = mine.reduce((a, x) => a + x.strokes, 0);
      let pts = 0;
      if (isParty()) {
        mine.forEach(m => { pts += 1 + played.filter(o => o.hole === m.hole && o.strokes > m.strokes).length; });
        results.filter(r => r.winner_id === pl.id).forEach(r => { pts += r.points; });
      }
      return { pl, pts, total, thru: mine.length };
    });
    if (isParty()) rows.sort((a, b) => b.pts - a.pts);
    else { const avg = r => (r.thru ? r.total / r.thru : Infinity); rows.sort((a, b) => avg(a) - avg(b)); }

    board.innerHTML = "";
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.append((i + 1) + ". ", figureEl(r.pl.color), r.pl.name + (r.pl.user_id === user.id ? " (you)" : ""));
      const val = document.createElement("span");
      val.textContent = isParty()
        ? r.pts + " pts" + (r.thru ? " (thru " + r.thru + ")" : "")
        : (r.thru ? r.total + " strokes (thru " + r.thru + ")" : "-");
      li.append(name, val);
      board.appendChild(li);
    });

    card.style.display = me ? "block" : "none";
    lateWrap.style.display = me ? "none" : "block";
    if (me && !cardReady) {
      cardReady = true;
      const done = myScores().map(x => x.hole);
      let h = 1;
      while (h < 18 && done.includes(h)) h++;
      setHole(h);
    } else if (me) drawCard();
  }

  const myScores = () => (me ? scores.filter(x => x.player_id === me.id) : []);

  function setHole(h) {
    hole = Math.min(18, Math.max(1, h));
    const ex = myScores().find(x => x.hole === hole);
    strokes = ex ? ex.strokes : 4;
    drawCard();
  }

  let stripHole = 0;

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
    strip.querySelectorAll(".hole-chip").forEach(b => {
      const n = +b.dataset.h;
      b.querySelector("small").textContent = mine[n] >= 11 ? "11+" : (mine[n] || "");
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
    grid.querySelectorAll("button").forEach(b => b.classList.toggle("selected", +b.dataset.s === mine[hole]));

    $("ch-box").style.display = isParty() ? "block" : "none";
    if (!isParty()) return;
    const ch = challengeFor(round.code, hole);
    $("ch-text").textContent = ch.text + " (" + (ch.pts > 0 ? "+" : "") + ch.pts + ")";
    const res = results.find(r => r.hole === hole && r.group_no === myGroup);
    const winner = res && players.find(pl => pl.id === res.winner_id);
    $("ch-winner").textContent = winner
      ? (ch.pts > 0 ? "Won by " : "Stuck with it: ") + winner.name
      : (isLeader ? "Tap who " + (ch.pts > 0 ? "won it" : "gets it") : "Your group's leader picks the winner");
    const pick = $("ch-pick");
    pick.style.display = isLeader ? "flex" : "none";
    pick.innerHTML = "";
    if (isLeader) {
      players.filter(pl => pl.group_no === myGroup).forEach(pl => {
        const b = document.createElement("button");
        b.append(figureEl(pl.color), pl.name);
        b.classList.toggle("selected", !!res && res.winner_id === pl.id);
        b.onclick = () => awardChallenge(pl.id);
        pick.append(b);
      });
    }
  }

  async function saveScore(n) {
    const { error } = await db.from("scores").upsert(
      { round_id: round.id, player_id: me.id, hole, strokes: n },
      { onConflict: "player_id,hole" });
    if (error) { toast("Error: " + error.message); return; }
    refresh();
  }

  async function awardChallenge(playerId) {
    const ch = challengeFor(round.code, hole);
    const { error } = await db.from("challenge_results").upsert(
      { round_id: round.id, hole, winner_id: playerId, points: ch.pts, group_no: me ? me.group_no : 1 },
      { onConflict: "round_id,hole,group_no" });
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
      { label: "Pick your stick figure", type: "colors", taken: players.map(p => p.color) }
    ], "I'm in");
    if (!vals) return;
    const { data: { session } } = await db.auth.getSession();
    if (!session) { userPromise = null; await ensureUser(); }
    const { error } = await db.from("players").insert({ round_id: round.id, name: vals[0], color: vals[1] === "-" ? null : vals[1] });
    if (error && error.code === "23505") { toast("Someone just grabbed that color. Pick another."); refresh(); return; }
    if (error) { toast("Error: " + error.message); return; }
    refresh();
  }
  join.onclick = doJoin;
  lateJoin.onclick = rejoin;

  await refresh();
  const live = { schema: "public" };
  db.channel("round-" + round.id)
    .on("postgres_changes", { ...live, event: "*", table: "players", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "scores", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "challenge_results", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "UPDATE", table: "rounds", filter: "id=eq." + round.id }, refresh)
    .subscribe();
}

const roundCode = new URLSearchParams(location.search).get("r");
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
