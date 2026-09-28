// ---------- Crabby, the Parcade mascot ----------
(function injectCrabbyCSS() {
  if (document.getElementById("crabby-css")) return;
  const st = document.createElement("style");
  st.id = "crabby-css";
  st.textContent = `
    .crabby { display: inline-block; line-height: 0; }
    .crabby svg { overflow: visible; }
    .crabby .cb-part { transform-box: view-box; }
    .crabby .cb-brows { transform-origin: 60px 45px; animation: cb-brow 4s ease-in-out infinite; }
    @keyframes cb-brow { 0%, 88%, 100% { transform: none; } 91% { transform: translateY(-3px); } 94% { transform: translateY(1px); } }
    .crabby .cb-tee { transform-origin: 66px 62px; animation: cb-chew 1.3s ease-in-out infinite alternate; }
    @keyframes cb-chew { from { transform: rotate(-6deg); } to { transform: rotate(8deg); } }
    .crabby .cb-tap { transform-origin: 67px 183px; animation: cb-tap 1.1s ease-in-out infinite; }
    @keyframes cb-tap { 0%, 50%, 100% { transform: none; } 20% { transform: rotate(-14deg); } }
    .crabby .cb-leg-l { transform-origin: 50px 150px; }
    .crabby .cb-leg-r { transform-origin: 70px 150px; }
    .walking .crabby .cb-leg-l { animation: cb-walk .28s ease-in-out infinite alternate; }
    .walking .crabby .cb-leg-r { animation: cb-walk .28s ease-in-out infinite alternate-reverse; }
    .walking .crabby .cb-tap, .strain .crabby .cb-tap { animation: none; }
    @keyframes cb-walk { from { transform: rotate(-20deg); } to { transform: rotate(20deg); } }
    .strain .crabby .cb-leg-l { animation: cb-strain .12s infinite alternate; }
    .strain .crabby .cb-leg-r { animation: cb-strain .12s infinite alternate-reverse; }
    @keyframes cb-strain { from { transform: rotate(-4deg); } to { transform: rotate(4deg); } }
    .crabby .cb-arms-up { display: none; }
    .holding .crabby .cb-arms-up { display: inline; }
    .holding .crabby .cb-arm-l, .holding .crabby .cb-arm-r, .holding .crabby .cb-glove, .holding .crabby .cb-club { display: none; }
    @media (prefers-reduced-motion: reduce) { .crabby * { animation: none !important; } }
  `;
  document.head.append(st);
})();

function crabbySVG(size) {
  const WHITE = "#EAF2FF", SKIN = "#E6C3A1", KNICK = "#C9B27C", VEST = "#6FCF8A",
        BLUE = "#4D8BFF", CREAM = "#F3E6C4", BROWN = "#A0673A", SILVER = "#C9D3E8", BG = "#060A1A";
  const G = (color, inner, cls = "", w = 3) =>
    '<g class="cb-part ' + cls + '" stroke="' + color + '" stroke-width="' + w + '" style="filter:drop-shadow(0 0 3px ' + color + ')">' + inner + '</g>';
  const parts = [
    G(BROWN, '<path d="M92 112L99 180"/>', "cb-club"),
    G(SILVER, '<path d="M96 179L111 184L112 178L99 175"/>', "cb-club"),
    '<g class="cb-part cb-leg-l">' +
      G(BLUE, '<path d="M45 152L55 152L54 176L46 176Z" fill="' + BG + '"/>') +
      G(CREAM, '<path d="M50 156L53 164L50 172L47 164Z"/>', "", 1.5) +
      G(BROWN, '<path d="M36 183Q38 175 46 176L54 183Z"/>') +
      G(WHITE, '<path d="M44 176.5L46 183"/>', "", 2) + '</g>',
    '<g class="cb-part cb-leg-r">' +
      G(BLUE, '<path d="M65 152L75 152L74 176L66 176Z" fill="' + BG + '"/>') +
      G(CREAM, '<path d="M70 156L73 164L70 172L67 164Z"/>', "", 1.5) +
      '<g class="cb-part cb-tap">' +
        G(BROWN, '<path d="M66 183Q68 175 74 176L84 183Z"/>') +
        G(WHITE, '<path d="M72 176.5L74 183"/>', "", 2) + '</g></g>',
    G(KNICK, '<path d="M44 116H76Q84 136 77 152L64 152Q62 136 60 128Q58 136 56 152L43 152Q36 136 44 116Z" fill="' + BG + '"/>', "cb-knickers"),
    G(KNICK, '<path d="M43 152H56M64 152H77"/>', "cb-knickers", 4),
    G(WHITE, '<path d="M47 76L38 88L44 92M73 76L82 88L76 92"/><path d="M52 72L60 78L68 72"/>', "cb-shirt"),
    G(VEST, '<path d="M47 76L73 76L76 116L44 116Z" fill="' + BG + '"/><path d="M52 76L60 88L68 76"/>', "cb-vest"),
    G(VEST, '<path d="M47 76L60 96L73 76M44 116L60 96L76 116"/>', "cb-vest", 1.5),
    G(BLUE, '<path d="M54 73L60 76L54 79Z" fill="' + BLUE + '"/><path d="M66 73L60 76L66 79Z" fill="' + BLUE + '"/>', "cb-bowtie", 1.5),
    G(SKIN, '<path d="M40 90L30 104L44 114"/>', "cb-arm-l"),
    G(SKIN, '<path d="M80 90L90 110"/>', "cb-arm-r"),
    G(WHITE, '<circle cx="91" cy="112" r="4"/>', "cb-glove", 2.5),
    G(SKIN, '<path d="M44 80L36 64L35 54M76 80L84 64L85 54"/>', "cb-arms-up"),
    G(SKIN, '<circle cx="60" cy="48" r="22" fill="' + BG + '"/>', "cb-head"),
    G(WHITE, '<path d="M39 46L31 43M38 52L29 52M81 46L89 43M82 52L91 52"/><path d="M47 31Q60 23 73 30"/>', "cb-hair", 2),
    G(WHITE, '<path d="M44 43L56 48M64 48L76 43"/>', "cb-brows", 4.5),
    G(WHITE, '<circle cx="51" cy="53" r="2.2" fill="' + WHITE + '"/><circle cx="69" cy="53" r="2.2" fill="' + WHITE + '"/>' +
      '<path d="M46 51H56M64 51H74" stroke-width="1.5"/>', "cb-eyes"),
    G(WHITE, '<path d="M52 64Q60 58 68 64"/>', "cb-frown", 2.5),
    '<g class="cb-part cb-tee"><g transform="rotate(18 66 62)">' +
      '<rect x="64" y="59.5" width="20" height="5" rx="2.5" fill="#8B5A2B" stroke="#000" stroke-width="1.2"/>' +
      '<path d="M70 59.5V64.5" stroke="#C9A24A" stroke-width="1.8"/>' +
      '<rect x="81" y="59.5" width="3.5" height="5" rx="1.5" fill="#FF7A3D" stroke="#000" stroke-width="1.2" style="filter:drop-shadow(0 0 3px #FF7A3D)"/>' +
      '</g></g>',
  ];
  return '<svg viewBox="0 0 120 200" width="' + size + '" height="' + (size * 200 / 120) + '" fill="none" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + parts.join("") + '</svg>';
}

function crabbyEl(size = 120) {
  const w = document.createElement("span");
  w.className = "crabby";
  w.setAttribute("role", "img");
  w.setAttribute("aria-label", "Crabby, the Parcade mascot");
  w.innerHTML = crabbySVG(size);
  return w;
}

const CRABBY_LINES = {
  welcome: "Welcome to the course, I'm Crabby. Nice shoes. Your mom pick 'em out? Name your round, type your name, pick a color, then hit Tee it up.",
  size: "How many of you are playing? Tap a number. Counting's the easy part, trust me.",
  mode: "Pick a game. Tap the little i if you need the rules explained like you're five.",
  modePicked: "Fine. Now hit Next before I change my mind.",
  waitingPlayers: "Send your buddies that link, or turn on One Device Mode and type their names in yourself. I'll wait. I'm used to waiting on you people.",
  tooMany: "Too many people for what you picked. Remove somebody or go back and change the count. Math is hard, I know.",
  teams: "Split everybody into Team A and Team B. Can't decide? Hit Randomize. You can't decide.",
  caddy: "Mark who's golfing and who's caddying, then who caddies for who. Try to keep up.",
  ready: "Everybody's here. Hit Start game. Slow play is a crime.",
  joiner: "Tap Join this round and type in your name. It's two steps. Try not to mess it up.",
  joined: "You're in. Now we wait on the slowpoke running this thing.",
};

function crabbyDesk(line) {
  const wrap = document.createElement("div");
  wrap.className = "crabby-desk";
  const stage = document.createElement("div");
  stage.className = "cd-stage";
  const fig = crabbyEl(84);
  fig.classList.add("cd-crabby");
  const counter = document.createElement("div");
  counter.className = "cd-counter";
  counter.innerHTML = '<svg viewBox="0 0 120 55" width="100%" height="100%" aria-hidden="true">' +
    '<rect x="2" y="8" width="116" height="45" rx="3" fill="#0E1630" stroke="#C9B27C" stroke-width="2.5"/>' +
    '<path d="M2 15H118" stroke="#C9B27C" stroke-width="1.5"/>' +
    '<text x="60" y="40" text-anchor="middle" font-family="Bungee, sans-serif" font-size="11" fill="#C9B27C">PRO SHOP</text>' +
    '<path d="M95 8Q95 1 101 1Q107 1 107 8Z" fill="#FFD84D"/><path d="M93 8H109" stroke="#FFD84D" stroke-width="1.5"/>' +
    '</svg>';
  stage.append(fig, counter);
  const bubble = document.createElement("div");
  bubble.className = "cd-bubble";
  bubble.setAttribute("aria-live", "polite");
  const textEl = document.createElement("span");
  textEl.className = "cd-text";
  bubble.append(textEl);
  let reserveLines = null, measured = false, tries = 0;
  const measure = () => {
    if (!reserveLines || measured) return;
    if (!wrap.isConnected || !textEl.offsetWidth) { if (++tries < 300) requestAnimationFrame(measure); return; }
    const cur = textEl.textContent;
    let max = 0;
    textEl.style.minHeight = "";
    reserveLines.forEach(l => { textEl.textContent = l; max = Math.max(max, textEl.offsetHeight); });
    textEl.textContent = cur;
    textEl.style.minHeight = max + "px";
    measured = true;
  };
  wrap.reserve = (lines) => { reserveLines = lines; measured = false; tries = 0; measure(); };
  window.addEventListener("resize", () => { if (reserveLines) { measured = false; tries = 0; measure(); } });
  wrap.append(stage, bubble);
  wrap.say = (text) => {
    if (!text || textEl.textContent === text) return;
    textEl.textContent = text;
    const secs = typeof Sound !== "undefined" ? Sound.grumble(text.length) : 0;
    if (secs && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fig.style.transformOrigin = "50% 70%";
      fig.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(2deg)" }, { transform: "rotate(0deg)" }],
        { duration: 260, iterations: Math.ceil(secs / 0.26) });
    }
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      bubble.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 250 });
    }
  };
  if (line) wrap.say(line);
  return wrap;
}

const CRABBY_SEASON = {
  tour: [
    "Oh good, a Seasons guy. A season strings your rounds together so you can keep beating the same friends all year long.",
    "Tap Start a season, then send the code to your buddies so they can join. They need accounts. Guests don't get to hold grudges.",
    "Whoever starts it is the commissioner. Only the commissioner adds rounds, and only rounds they actually played in.",
    "Every round pays out season points: 5 for 1st, 3 for 2nd, 1 for 3rd. Everybody else gets character development.",
    "Playing for money? I track who's up, who's down, the biggest win, the biggest loss, and everybody's side bet record. Try not to cry.",
    "That's it. Tap Start a season, or Join with a code if somebody already did the hard part.",
  ],
  tourGuest: [
    "Oh good, a Seasons guy. A season strings your rounds together so you can keep beating the same friends all year long.",
    "Seasons need an account so your points follow you around. Hit Create account or Sign in below. I'll wait. Again.",
  ],
  owner: "This is your season, commissioner. Share the link, then add rounds from the list at the bottom. Standings and money update themselves.",
  member: "Standings up top, money below if you play for cash. The commissioner adds the rounds, so complain to them, not me.",
  join: "Hit Join this season. Takes two seconds. Even you can manage that.",
  guest: "You need an account to join a season. Create one or sign in. Guests don't get to hold grudges.",
};

function crabbyTour(desk, lines) {
  desk.reserve(lines);
  let i = 0;
  const ctl = document.createElement("div");
  ctl.className = "cd-ctl";
  const count = document.createElement("span");
  count.className = "cd-count";
  const next = document.createElement("button");
  next.className = "link-btn";
  ctl.append(count, next);
  desk.querySelector(".cd-bubble").append(ctl);
  const show = () => {
    desk.say(lines[i]);
    count.textContent = (i + 1) + " / " + lines.length;
    next.textContent = i < lines.length - 1 ? "Next" : "Got it";
  };
  next.onclick = () => {
    if (i < lines.length - 1) { i++; show(); } else ctl.remove();
  };
  if (lines.length > 1) show(); else { ctl.remove(); desk.say(lines[0]); }
}
