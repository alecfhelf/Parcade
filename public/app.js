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

// ---------- Theme: dark (default), light, or match the phone ----------
const THEME_KEY = "parcade-theme";
const LIGHT_BG = "#F4F6FB";
const themeMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function hexLum(hex) {
  const [r, g, b] = hexRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function hexHsl(hex) {
  const [r, g, b] = hexRgb(hex).map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (!d) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
// Darken a neon color until it reads on the light background (3.5:1). Pale colors also lose
// saturation so they stay distinguishable from the deep ones once both are darkened.
const LIGHT_HEX = {};
function lightHex(hex) {
  hex = String(hex).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)) return hex;
  if (LIGHT_HEX[hex]) return LIGHT_HEX[hex];
  if (hex === "#FFFFFF") return (LIGHT_HEX[hex] = "#2B3245");
  let [h, s, l] = hexHsl(hex), out = hex;
  if (l >= 75) s *= 0.55;
  const bg = hexLum(LIGHT_BG);
  while (l > 0 && (bg + 0.05) / (hexLum(out = hslHex(h, s, l)) + 0.05) < 3.5) l -= 1;
  return (LIGHT_HEX[hex] = out);
}
function isLight() { return document.documentElement.getAttribute("data-theme") === "light"; }
// Player/team color as it should render right now
function themeHex(hex) { return hex && isLight() ? lightHex(hex) : hex; }
// Set a CSS property to a player color and keep it in sync when the theme flips
function paintColor(el, prop, hex) {
  if (!hex) return;
  el.dataset.pc = hex;
  el.dataset.pcProp = prop;
  el.style.setProperty(prop, themeHex(hex));
}
(function injectThemeCSS() {
  // SVG art uses stroke/fill attributes; remap each fixed color to its light variant
  // (other art may use them). Pixel characters (svg.px, sprites.js) keep their own colors in both themes.
  const extra = ["#2E6BFF", "#E6C3A1", "#C9B27C", "#6FCF8A", "#F3E6C4", "#C9A24A", "#FF7A3D", "#8A6A4A", "#F2F5FA", "#1B1030", "#C9D3E8",
    "#E8EEF8", "#7A4FD1", "#FF7A3D", "#FFF3B0", "#D9DEE8", "#3FA35B", "#5B7FD1", "#6B4A2E", "#2B3245", "#EAF2FF"];
  const rules = PALETTE.map(p => p[0]).concat(extra).map(hex => {
    const l = lightHex(hex), sel = ':root[data-theme="light"] :not(.px) > ';
    return sel + '[stroke="' + hex + '" i] { stroke: ' + l + '; } ' + sel + '[fill="' + hex + '" i] { fill: ' + l + '; }';
  });
  const st = document.createElement("style");
  st.id = "theme-css";
  st.textContent = rules.join("\n");
  document.head.append(st);
})();
function themePref() {
  let p = null;
  try { p = localStorage.getItem(THEME_KEY); } catch (e) {}
  return p === "light" || p === "system" ? p : "dark";
}
function applyTheme() {
  const p = themePref();
  const light = p === "light" || (p === "system" && !!themeMQ && themeMQ.matches);
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    if (!m.dataset.dark) m.dataset.dark = m.content;
    m.content = light ? LIGHT_BG : m.dataset.dark;
  });
  document.querySelectorAll("[data-pc]").forEach(el => el.style.setProperty(el.dataset.pcProp, themeHex(el.dataset.pc)));
  document.dispatchEvent(new Event("parcade-theme"));
}
function setThemePref(p) {
  try { localStorage.setItem(THEME_KEY, p); } catch (e) {}
  applyTheme();
}
if (themeMQ) {
  const onPhoneTheme = () => { if (themePref() === "system") applyTheme(); };
  if (themeMQ.addEventListener) themeMQ.addEventListener("change", onPhoneTheme); else if (themeMQ.addListener) themeMQ.addListener(onPhoneTheme);
}
applyTheme();

// Small sun/moon button for the home screen (guests can't open Profile)
function themeButton() {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "copy-top sound-btn";
  const sync = () => {
    const light = isLight();
    b.innerHTML = light
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
    const label = light ? "Switch to dark mode" : "Switch to light mode";
    b.setAttribute("aria-label", label);
    b.title = label;
  };
  b.onclick = () => setThemePref(isLight() ? "dark" : "light");
  document.addEventListener("parcade-theme", sync);
  sync();
  return b;
}

// figureEl(color | player, size, outfit | pose, roomy). A player row brings its own color and outfit.
// The round's color is the shirt color, so figures match everything else colored by player. extra === true is the
// winner pose; a pose name ("cheer", "fist", ...) works too. size is the old 24 grid size: the pixel sprite is drawn
// 1.25x that tall at its 22:30 ratio, about the same footprint. roomy is unused now (sprites never overflow).
function figureEl(who, size = 18, extra, roomy) {
  const pl = who && typeof who === "object" ? who : null;
  const color = pl ? pl.color : who;
  const pose = extra === true ? "cheer" : typeof extra === "string" ? extra : "idle";
  const outfit = extra && typeof extra === "object" ? extra : pl && pl.outfit;
  const h = Math.round(size * 1.25), w = Math.round(h * PX.W / PX.H);
  const el = document.createElement("span");
  el.className = "stick";
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.innerHTML = PX.svg(outfitFor(color, outfit), pose);
  return el;
}

function holeAllowances(round, players) {
  ACTIVE_RANKS = ROUND_RANKS[round.id] || null;
  const map = {};
  if (!round.handicap) return map;
  const vals = players.map(p => p.usual_score).filter(v => v);
  if (!vals.length) return map;
  // Tournament rounds measure from the best player in the whole tournament, not just this round
  const best = round.hcp_base != null ? Number(round.hcp_base) : Math.min(...vals);
  players.forEach(p => { map[p.id] = p.usual_score ? Math.max(0, Math.round(p.usual_score - best)) / 18 : 0; });
  return map;
}
const ROUND_RANKS = {};
let ACTIVE_RANKS = null;
// Holes in a round: 18, or 9 for a 9-hole mini-golf card. Set when the round's course loads.
const ROUND_HOLES = {};
const holesIn = round => ROUND_HOLES[round.id] || 18;
const MINI_TAG = () => { const t = document.createElement("span"); t.className = "mini-tag"; t.textContent = "Mini-golf"; return t; };
const strokesOn = (a, hole) => {
  if (ACTIVE_RANKS) {
    const total = Math.round(a * 18), rank = ACTIVE_RANKS[hole - 1];
    return total >= rank ? Math.floor((total - rank) / 18) + 1 : 0;
  }
  return Math.floor(hole * a + 1e-9) - Math.floor((hole - 1) * a + 1e-9);
};
const netOf = (x, allow) => x.strokes - strokesOn(allow[x.player_id] || 0, x.hole);
function strokeHolesText(a) {
  const list = [];
  let allOne = true;
  for (let h = 1; h <= 18; h++) {
    const s = strokesOn(a, h);
    if (s) list.push(s > 1 ? h + " (x" + s + ")" : String(h));
    if (s !== 1) allOne = false;
  }
  if (!list.length) return "Plays straight up";
  return allOne ? "Strokes on every hole" : "Strokes on holes " + list.join(", ");
}
const validHcp = (v) => { const n = parseFloat(v); return !isNaN(n) && n >= -10 && n <= 54; };
async function askHandicap(name, current, prefill) {
  const cur = current || {};
  const plusPrefill = prefill && cur.hcp != null && cur.hcp < 0;
  const v = await ask(name ? "Handicap for " + name : "What's your handicap?", [
    { label: "Type in your handicap", type: "number", decimal: true, max: 5, placeholder: cur.hcp != null ? String(Math.abs(cur.hcp)) : "e.g. 14.2",
      value: prefill && cur.hcp != null ? String(Math.abs(cur.hcp)) : "" },
    { label: "Plus handicap", type: "toggle", hint: "Better than scratch? Flip this on and type the number, like 2 for +2." + (plusPrefill ? " (Currently a plus handicap.)" : "") }
  ], "Lock it in", null,
  async ([x, t]) => {
    const n = parseFloat(x);
    if (isNaN(n)) return "Enter a number, like 14.2.";
    const plusOn = t === "on" || n < 0;
    const h = plusOn ? -Math.abs(n) : n;
    return h >= -10 && h <= 54 ? null : plusOn ? "Plus handicaps go up to 10." : "Enter a handicap between 0 and 54.";
  }, null,
  name ? "They don't know their handicap" : "I don't know my handicap");
  if (v === "ALT") {
    const u = await askUsual(name ? "What does " + name + " usually shoot?" : null, cur.usual);
    return u == null ? null : { usual: u, hcp: null };
  }
  if (!v) return null;
  const n = parseFloat(v[0]);
  const plusOn = v[1] === "on" || n < 0;
  const h = Math.round((plusOn ? -Math.abs(n) : n) * 10) / 10;
  return { usual: Math.round(72 + h), hcp: h };
}
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
    b.dataset.hex = hex;
    b.append(figureEl(hex, 24, f.outfit || undefined));
    b.onclick = () => {
      input.value = hex;
      row.querySelectorAll(".swatch").forEach(x => {
        x.classList.toggle("selected", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
    };
    row.append(b);
  });
  wrap.append(span, row, input);
  panel.append(wrap);
  const saved = f.selected && [...row.querySelectorAll(".swatch:not(:disabled)")].find(x => x.dataset.hex === f.selected);
  const first = saved || row.querySelector(".swatch:not(:disabled)");
  if (first) first.click(); else input.value = "-";
  return input;
}

function ask(title, fields, confirmText, note, onSubmit, guide, alt) {
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
      if (f.type === "check") {
        const row = document.createElement("label");
        row.className = "check-row";
        const box = document.createElement("input");
        box.type = "checkbox";
        const txt = document.createElement("span");
        txt.innerHTML = f.html;
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.value = "no";
        box.onchange = () => (hidden.value = box.checked ? "yes" : "no");
        row.append(box, txt, hidden);
        panel.append(row);
        return hidden;
      }
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = f.label;
      const input = document.createElement("input");
      input.placeholder = f.placeholder || "";
      if (f.value) input.value = f.value;
      input.maxLength = f.max || 40;
      input.autocomplete = "off";
      if (f.type) input.type = f.type;
      if (f.type === "number") { input.inputMode = f.decimal ? "decimal" : "numeric"; if (f.decimal) input.step = "any"; }
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
    if (alt) {
      const a = document.createElement("button");
      a.type = "button";
      a.className = "link-btn";
      a.style.margin = "0 0 12px";
      a.textContent = alt;
      a.onclick = () => close("ALT");
      panel.append(a);
    }
    const err = document.createElement("p");
    err.className = "modal-error";
    err.setAttribute("role", "alert");
    panel.append(err, row);
    const stack = document.createElement("div");
    stack.className = "modal-stack";
    if (guide) {
      const d = crabbyDesk(guide);
      d.classList.add("modal-guide");
      stack.append(d);
    }
    stack.append(panel);
    wrap.append(stack);
    requestAnimationFrame(() => (wrap.scrollTop = 0));
    document.body.append(wrap);
    setTimeout(() => { (inputs[0] || ok).focus({ preventScroll: true }); wrap.scrollTop = 0; }, 50);
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
// Mini-golf deck: drop the cards that need a real course, add some putt-putt ones
const REAL_COURSE_ONLY = ["Longest Tee Shot", "Longest Tee Shot in the Fairway", "Longest Second Shot", "Longest Drive, Any Lie",
  "First Putt Closest to the Hole", "Fewest Putts", "CURSE: Shortest Tee Shot", "CURSE: Most Putts",
  "If you only use your driver, you get +2", "If you only use your irons, you get +2", "If you only use your putter, you get +2"];
const MINI_CHALLENGES = CHALLENGES.filter(c => !REAL_COURSE_ONLY.includes(c[0])).concat([
  ["Best Bank Shot", 2],
  ["Closest After the Obstacle", 1],
  ["CURSE: Ball Leaves the Course", -1],
  ["CURSE: Most Obstacle Hits", -1],
  ["If you hole out off a wall, you get +2", 2, "multi"],
  ["If you putt one-handed the whole hole, you get +2", 2, "multi"],
  ["If you putt with your other hand, you get +2", 2, "multi"],
]);
const deckFor = round => (round && round.mini ? MINI_CHALLENGES : CHALLENGES);

const LINES = {
  birdie: [
    "🐦 Birdie for {name} on hole {hole}! Somebody check that bag for a magnet.",
    "{name} birdied hole {hole}. Enjoy it, it won't happen again. 🐦",
    "Birdie on {hole} for {name}. Who even is this? 👀",
    "{name} with a birdie on hole {hole}. Somebody buy them a drink. 🍺",
    "{name} just birdied {hole}. The group chat is shook. 🐦🔥",
  ],
  eagle: [
    "🦅 EAGLE for {name} on hole {hole}!! Somebody order a drug test. 🧪",
    "{name} made an eagle on hole {hole}. Frame this scorecard. 🖼️",
    "{name} eagled hole {hole}. Everyone else, just go home. 🦅",
  ],
  albatross: [
    "{name} made an ALBATROSS on hole {hole}. {n} on a par {par}. Somebody call the news. 📰🤯",
    "ALBATROSS for {name} on hole {hole}. That's not golf, that's witchcraft. 🧙",
  ],
  triple: [
    "{name} made a triple bogey on hole {hole}. Someone check on them. 😬",
    "Triple on {hole} for {name}. The course is filing a complaint. 📝",
    "{name}: {n} on a par {par}. Bowling is the other sport, friend. 🎳",
    "{name} took the scenic route on hole {hole}. Triple bogey. 🗺️",
    "{name} triple-bogeyed {hole}. Legally we have to call that cardio. 🏃",
  ],
  blowup: [
    "{name} shot {n} on a par {par}. We stopped counting out of respect. 🪦",
    "{name} went +{over} on hole {hole}. The groundskeeper wants that grass back. 🌱",
    "{n} on a par {par}? {name}, blink twice if you need help. 👀",
    "{name} made a {n} on hole {hole}. Somewhere, a golf instructor just felt a chill. 🥶",
    "{name} gave the ball a full tour of hole {hole}. +{over}. The cart attendant looked away.",
  ],
  ace: [
    "HOLE IN ONE for {name} on hole {hole}!! 🤯🏆 Drinks are on {name}.",
    "{name} aced hole {hole}. Frame this scorecard. 🖼️🔥",
    "{name} just holed it in ONE on hole {hole}. Somebody call the news. 📰🤯",
  ],
  two: [
    "{name} shot a 2 on hole {hole}. Wow. 🔥",
    "{name} with a 2 on hole {hole}. Who even is this? 👀",
    "Dang, {name}. A 2 on hole {hole}. 🎯",
    "{name} put up a 2 on hole {hole}. Somebody order a drug test. 🧪",
  ],
  bad: [
    "{name} shot a {n} on hole {hole}... Yikes. 😬",
    "{name} carded a {n} on hole {hole}. Someone check on them.",
    "{name} took {n} swings on hole {hole}. The course is filing a complaint. 📝",
    "{n} on hole {hole} for {name}. Bowling is the other sport, friend. 🎳",
    "Breaking news: {name} finally finished hole {hole}. Final count: {n}. 📺",
    "{name} put up a {n} on hole {hole}. The ball is asking for a new owner.",
    "{n} strokes on hole {hole}. {name}, blink twice if you need help. 👀",
    "{name} shot {n} on hole {hole}. Legally we have to call that cardio. 🏃",
    "{name} gave the ball a full tour of hole {hole}. {n} stops on the itinerary. 🗺️",
    "{name}: {n} on hole {hole}. Even the cart attendant looked away.",
  ],
  disaster: [
    "{name} went 11+ on hole {hole}. We stopped counting out of respect. 🪦",
    "{name}: 11+ on hole {hole}. Somewhere, a golf instructor just felt a chill. 🥶",
    "{name} hit 11+ on hole {hole}. The groundskeeper wants that grass back. 🌱",
    "11+ on hole {hole}. {name} is now legally a landscaper. 🚜",
  ],
};

function scoreLine(name, n, hole, par) {
  let pool;
  if (par) {
    const d = n - par;
    pool = n === 1 ? LINES.ace : d <= -3 ? LINES.albatross : d === -2 ? LINES.eagle : d === -1 ? LINES.birdie
      : d === 3 ? LINES.triple : d >= 4 ? LINES.blowup : null;
  } else {
    pool = n === 1 ? LINES.ace : n === 2 ? LINES.two : n >= 11 ? LINES.disaster : n >= 8 ? LINES.bad : null;
  }
  if (!pool) return null;
  return pool[Math.floor(Math.random() * pool.length)]
    .replaceAll("{name}", name).replaceAll("{n}", n >= 11 ? "11+" : String(n)).replaceAll("{hole}", String(hole))
    .replaceAll("{par}", String(par)).replaceAll("{over}", String(n - par));
}

function challengeFor(code, hole, deck = CHALLENGES) {
  let seed = 0;
  for (const c of code) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const order = deck.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const [text, pts, multi] = deck[order[(hole - 1) % order.length]];
  return { text, pts, multi: !!multi };
}

// Check the live session on every call: a phone left in the background can lose
// its session (expired token that failed to refresh), and a cached user would let
// writes go out as the anon role and fail RLS. userPromise only dedupes sign-ins.
let userPromise = null;
async function ensureUser() {
  const { data: { session } } = await db.auth.getSession();
  if (session) return session.user;
  if (!userPromise) {
    userPromise = (async () => {
      const { data, error } = await db.auth.signInAnonymously();
      if (error) throw error;
      return data.session.user;
    })().finally(() => { userPromise = null; });
  }
  return userPromise;
}

// ---------- Tiers: guest (no account), free account, Club Member (supabase/club.sql) ----------
// The database decides who's a member (is_club_member, plus triggers on rounds and tournaments).
// This copy only picks which options to lock. Reloaded when the account changes or the app comes back into view.
const CLUB = { uid: null, member: false };
let clubLoading = null;
async function loadClub(force) {
  let u = null;
  try { const { data: { session } } = await db.auth.getSession(); u = session && session.user; } catch (e) {}
  window.__signedIn = !!(u && !u.is_anonymous);
  const uid = window.__signedIn ? u.id : null;
  if (force || !clubLoading || CLUB.uid !== uid) {
    if (CLUB.uid !== uid) CLUB.member = false;
    CLUB.uid = uid;
    clubLoading = !uid ? Promise.resolve(false) : db.rpc("is_club_member").then(({ data, error }) => {
      if (CLUB.uid === uid) CLUB.member = !error && data === true;
      return CLUB.member;
    }, () => CLUB.member);
  }
  return clubLoading;
}
function tier() {
  return !window.__signedIn ? "guest" : CLUB.member ? "club" : "free";
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && window.__signedIn) {
    const was = CLUB.member;
    loadClub(true).then(m => { if (m !== was) renderAccount(); });
  }
});

// Every game mode but Stroke Play is a Club Member perk
function clubModeLock() {
  if (tier() === "club") return {};
  return Object.fromEntries(Object.keys(MODES).filter(k => k !== "stroke").map(k => [k, "Club Members"]));
}

// Tapped something that's a Club Member perk
async function needClub(what) {
  const pick = await pickFrom(CRABBY_LINES.clubPerk + (what ? " (" + what + ")" : ""), [
    { label: "Become a Club Member", value: "club" },
    { label: "Not now", value: "no" }
  ], { noCancel: true });
  if (pick === "club") location.href = "/club";
}

// Small gold "Club Member" title next to a name
function clubBadge() {
  const b = document.createElement("span");
  b.className = "club-badge";
  b.textContent = "Club Member";
  return b;
}

// Netlify functions that check who's asking (courses, scan)
async function authedFetch(url, init = {}) {
  const { data: { session } } = await db.auth.getSession();
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: "Bearer " + (session ? session.access_token : "") } });
}

$("create-round").addEventListener("click", () => startRound(false));
$("create-mini").addEventListener("click", () => startRound(true));
async function startRound(mini) {
  const myName = await accountName();
  const fit = await myOutfit();
  const vals = await ask(mini ? "Start a mini-golf round" : "Start a new round", [
    { label: "Round name", placeholder: "Saturday Showdown" },
    { label: "Your name", placeholder: "What your crew calls you", max: 20, value: myName }
  ], "Tee it up", null, null, CRABBY_LINES.welcome);
  if (!vals) return;
  const [roundName, playerName] = vals;
  const color = fit.shirtColor || "-";
  const hcp = false;
  const mineHc = mini ? null : await myHandicap();
  const usual = mineHc ? mineHc.usual : null, hcpNum = mineHc ? mineHc.hcp : null;
  try {
    await ensureUser();
    const { data: round, error: e1 } = await db.from("rounds")
      .insert({ name: roundName.trim(), handicap: hcp, ...(mini ? { mini: true } : {}) }).select().single();
    if (e1) throw e1;
    const pc = color === "-" ? null : color;
    const { error: e2 } = await insertPlayer({ round_id: round.id, name: playerName.trim(), color: pc, usual_score: usual, hcp: hcpNum,
      outfit: { ...fit, shirtColor: pc || fit.shirtColor } });
    if (e2) throw e2;
    openRound(round.code);
  } catch (err) {
    $("status").textContent = "Error: " + err.message;
  }
}

const MODES = {
  party: { name: "Party Mode", desc: "Points every hole plus a random challenge card. Bonuses, curses, and bragging rights." },
  stroke: { name: "Stroke Play", desc: "Regular golf rules, lowkey boring but so is your personality." },
  stableford: { name: "Stableford", desc: "Points vs par every hole. Par is 2, birdie 3, blow-ups just score 0. Most points wins." },
  skins: { name: "Skins", desc: "Ties roll the prize into the next hole, so holes stack up. One clutch hole can win you a pile." },
  match: { name: "Match Play", desc: "Win a hole for 1 point. Tie it and everyone tied gets half. Most points wins the match." },
  nassau: { name: "Nassau", desc: "Three bets in one: front 9, back 9 and the full 18. Match play, so every hole is a fight." },
  wad: { name: "Wad", desc: "Drain your first putt from long range and the pot grows. Make the last one of the round and everybody pays you." },
  vegas: { name: "Vegas", desc: "2 vs 2. Your team's scores mash into one number, so a 4 and a 5 is 45. Lowest number wins the difference." },
  bestball: { name: "Best Ball", desc: "2 vs 2. Your team's best score on each hole counts. Carry your partner, or get carried." },
  sixes: { name: "Sixes", desc: "4 players. Partners rotate every 6 holes, so everyone teams up with everyone. Win the most 6-hole matches." },
  bbb: { name: "Bingo Bango Bongo", desc: "Three points every hole: first on the green, closest to the pin, first in the cup. Anyone can steal them." },
  caddy: { name: "Cart Caddy", desc: "Non-golfers become caddies with ridiculous powers. Call the shot, earn points, fight for Best Caddy." },
  wolf: { name: "Wolf", desc: "Groups of 3 or 4. Pick a partner off the tee or go it alone. Loyalty is optional." },
};

// Game-mode tiles with the i button for the full rules and a description line underneath.
// Used by round setup and tournaments. opts: { modes: [key], selected, off: { key: why not }, onPick(key), onLocked(key) }
function modeGrid(opts) {
  let picked = opts.selected || null, off = opts.off || {};
  const wrap = document.createElement("div");
  const grid = document.createElement("div");
  grid.className = "mode-grid";
  const preview = document.createElement("p");
  preview.className = "mode-preview";
  preview.setAttribute("aria-live", "polite");
  const showDesc = (key) => {
    preview.textContent = !key ? "Hover over a game for a quick description. Tap the i for the full rules."
      : off[key] ? MODES[key].name + " isn't available: " + off[key]
      : MODES[key].name + ": " + ((opts.descs && opts.descs[key]) || MODES[key].desc);
  };
  const tiles = {};
  opts.modes.forEach(key => {
    const m = MODES[key];
    const cell = document.createElement("div");
    cell.className = "mode-cell";
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "game-tile";
    const name = document.createElement("span");
    name.textContent = m.name;
    const why = document.createElement("small");
    why.className = "game-why";
    tile.append(name, why);
    tile.onmouseenter = () => showDesc(key);
    tile.onfocus = () => showDesc(key);
    tile.onmouseleave = () => showDesc(picked);
    tile.onblur = () => showDesc(picked);
    tile.onclick = () => {
      showDesc(key);
      if (off[key]) { if (opts.onLocked) opts.onLocked(key); return; }
      picked = key;
      draw();
      if (opts.onPick) opts.onPick(key);
    };
    const info = infoBtn("How " + m.name + " works", () => (opts.info ? opts.info(key) : showRulesModal(m.name, [key, "round"])));
    info.type = "button";
    info.classList.add("info-corner");
    cell.append(tile, info);
    grid.append(cell);
    tiles[key] = { tile, why };
  });
  function draw() {
    Object.entries(tiles).forEach(([key, x]) => {
      x.tile.classList.toggle("selected", key === picked);
      x.tile.classList.toggle("off", !!off[key]);
      x.tile.setAttribute("aria-disabled", String(!!off[key]));
      x.why.textContent = off[key] || "";
    });
  }
  // Size the description line for the longest text so the page doesn't jump around
  function fit() {
    if (!preview.isConnected) return;
    preview.style.minHeight = "";
    let tallest = 0;
    [null, ...opts.modes].forEach(k => { showDesc(k); tallest = Math.max(tallest, preview.offsetHeight); });
    preview.style.minHeight = tallest + "px";
    showDesc(picked);
  }
  wrap.append(grid, preview);
  draw();
  showDesc(picked);
  return {
    el: wrap, fit,
    setOff(o) { off = o || {}; draw(); fit(); },
    setPicked(key) { picked = key; draw(); showDesc(picked); },
  };
}

async function loadRound(code) {
  startRoundLoading();
  $("create-round").style.display = "none";
  document.querySelectorAll(".home-only").forEach(el => (el.style.display = "none"));
  document.body.classList.add("in-round");
  const box = document.createElement("div");
  box.style.cssText = "margin-top:16px;width:100%;max-width:360px";
  $("status").before(box);

  const user = await ensureUser();
  window.__signedIn = !user.is_anonymous;
  await loadClub();
  const fetchRound = () => db.from("rounds").select("*").eq("code", code.toUpperCase()).maybeSingle();
  let { data: round } = await fetchRound();
  if (!round) {
    // Maybe it's a season or tournament code
    const c = code.toUpperCase();
    const [{ data: sea }, { data: tn }] = await Promise.all([
      db.from("seasons").select("code").eq("code", c).maybeSingle(),
      db.from("tournaments").select("code").eq("code", c).maybeSingle()
    ]);
    if (sea) { location.replace("/?s=" + c); return; }
    if (tn) { location.replace("/?t=" + c); return; }
    endRoundLoading();
    const h1 = document.querySelector("h1");
    h1.textContent = "No match";
    const sub = document.querySelector("h1 + p");
    if (sub) sub.textContent = "Code " + c;
    const msg = document.createElement("p");
    msg.className = "waiting";
    msg.textContent = "That code doesn't match a round, season or tournament. Check for typos, or ask whoever invited you to send the link again.";
    const home = document.createElement("button");
    home.textContent = "Back to home";
    home.style.cssText = "width:100%;margin-top:14px";
    home.onclick = () => location.replace("/");
    box.append(msg, home);
    return;
  }

  document.querySelector("h1").textContent = round.name;
  if (round.mini) document.querySelector("h1").append(" ", MINI_TAG());
  const sub = document.querySelector("h1 + p");
  const link = location.origin + "/?r=" + round.code;
  // Joiners play under the host's settings, so side bets follow the host's membership
  const hostClub = round.host_id === user.id ? tier() === "club"
    : await db.rpc("is_club_member", { p_user: round.host_id }).then(({ data }) => data === true, () => false);

  let me = null, players = [], scores = [], results = [], picks = [], pairs = [], preds = [], mulls = [], bets = [], wads = [], course = null, pmulls = [];
  let hole = 1, strokes = 4, cardReady = false, pickedMode = null;
  const clubIds = new Set(), clubChecked = new Set();
  const isParty = () => !round.mode || round.mode === "party";
  const isSkins = () => round.mode === "skins";
  const isMatch = () => round.mode === "match";
  const isCaddy = () => round.mode === "caddy";
  const isBbb = () => round.mode === "bbb";
  const isBest = () => round.mode === "bestball";
  const isVegas = () => round.mode === "vegas";
  const isSixes = () => round.mode === "sixes";
  const isNassau = () => round.mode === "nassau";
  const isWad = () => round.mode === "wad";
  const isWolf = () => round.mode === "wolf";
  const isStab = () => round.mode === "stableford";
  // Guests' mini-golf cards live on the round (rounds.mini_course), never in the courses table
  const guestCard = () => round.mini && !window.__signedIn;
  const cardOnRound = () => ({ id: null, mini: true, name: round.mini_course.name, pars: round.mini_course.pars });
  async function keepCardOnRound(m) {
    const mini_course = { name: m.name, pars: m.pars };
    const { error } = await db.from("rounds").update({ mini_course, course_id: null }).eq("id", round.id);
    if (error) { toast(error.message); return null; }
    round.mini_course = mini_course;
    round.course_id = null;
    course = cardOnRound();
    ROUND_RANKS[round.id] = null;
    ROUND_HOLES[round.id] = course.pars.length === 9 ? 9 : 18;
    return course;
  }
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
  guide.reserve(Object.values(CRABBY_LINES).filter(l => l !== CRABBY_LINES.welcome));
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
    const SIZES = [["1", "1 player"], ["2", "2 players"], ["3", "3 players"], ["4", "4 players"], ["5", "5 or more"]];
    const sizeFits = { "1": n => n === 1, "2": n => n === 2, "3": n => n === 3, "4": n => n === 4, "5": n => n >= 5 };
    const MODES_ALL = { "1": ["stroke", "stableford", "party"], "2": ["party", "stroke", "stableford", "skins", "match", "nassau", "wad", "caddy"], "3": ["party", "stroke", "stableford", "skins", "match", "wolf", "bbb", "wad", "caddy"], "4": ["party", "stroke", "stableford", "skins", "match", "nassau", "wolf", "bbb", "bestball", "sixes", "vegas", "wad", "caddy"], "5": ["party", "stroke", "stableford", "skins", "match", "wolf", "bbb", "bestball", "vegas", "wad", "caddy"] };
    const modeRules = key => showRulesModal(MODES[key].name, [key, "round"], deckFor(round), holesIn(round), round.mini);
    // Mini-golf: no "first on the green" (bbb), every shot is a putt (wad), everyone's playing (caddy)
    const MINI_HIDDEN = ["bbb", "wad", "caddy"];
    // Tournament rounds already have the tournament's mode. Everyone else gets Stroke Play unless they're in the Club.
    const isClub = tier() === "club";
    const modeLock = () => (round.tournament_id ? {} : clubModeLock());
    const lockedMode = key => { if (modeLock()[key]) needClub(MODES[key].name); };
    const MODES_BASE = Object.fromEntries(Object.entries(MODES_ALL).map(([k, list]) => [k, round.mini ? list.filter(m => !MINI_HIDDEN.includes(m)) : list]));
    // Nassau needs 18 holes, so it's hidden on 9-hole mini-golf cards. The card can change in setup, so this is checked live.
    const modesFor = key => MODES_BASE[key].filter(m => m !== "nassau" || holesIn(round) === 18);
    const SIZE_NOTES = {
      "1": "Just you and the course. Kinda sad, but great for keeping score.",
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
    odRow.classList.add("settings-only");
    odNote.classList.add("settings-only");
    const setupBack = document.createElement("button");
    setupBack.className = "link-btn setup-only";
    setupBack.textContent = "Change game";
    setupBack.onclick = () => setStep("mode");
    const setupTitle = h3("How do you want to play?");
    setupTitle.classList.add("setup-only");
    const setupNext = document.createElement("button");
    setupNext.className = "setup-only";
    setupNext.textContent = "Next: add players";
    setupNext.style.cssText = "width:100%;margin-top:14px";
    setupNext.onclick = () => setStep("room");
    hostArea.append(setupBack, setupTitle, odRow, odNote);
    const roomGame = document.createElement("div");
    roomGame.className = "room-only";
    function renderRoomGame() {
      roomGame.innerHTML = "";
      if (!pickedSize) return;
      const head = h3("Game mode");
      head.style.marginTop = "28px";
      roomGame.append(head);
      const picker = modeGrid({ modes: modesFor(pickedSize), selected: pickedMode, off: modeLock(), info: modeRules, onLocked: lockedMode, onPick: key => {
        pickedMode = key;
        renderModes();
        updateStart();
        renderLobbyList();
        guide.say(guideLine());
        stepSummary.textContent = MODES[pickedMode].name + ", " + SIZES.find(([k]) => k === pickedSize)[1].toLowerCase() + (course ? ", " + course.name : "");
      } });
      roomGame.append(picker.el);
      picker.fit();
    }
    const roomSettingsHead = h3("Round settings");
    roomSettingsHead.classList.add("room-only");
    let settingsPlace = null;
    function placeSettings(st) {
      if (!startBtn.parentNode) return;
      const where = st === "room" ? "room" : "setup";
      if (settingsPlace === where) return;
      settingsPlace = where;
      const els = [odRow, odNote, hcRow, pressRow, money, mullArea];
      if (setupNext.nextElementSibling !== startBtn) startBtn.before(setupNext);
      if (where === "room") {
        let after = startBtn;
        [roomGame, roomSettingsHead, ...els].forEach(e => { after.after(e); after = e; });
      } else els.forEach(e => setupNext.before(e));
    }
    const hcRow = document.createElement("div");
    hcRow.className = "toggle-row od-row settings-only";
    const hcTxt = document.createElement("div");
    const hcLabel = document.createElement("span");
    hcLabel.className = "field-label";
    hcLabel.textContent = "Handicaps";
    const hcHint = document.createElement("small");
    hcHint.textContent = "Levels the field. Everyone enters what they usually shoot for 18.";
    hcTxt.append(hcLabel, hcHint);
    const hcSwitch = document.createElement("button");
    hcSwitch.type = "button";
    hcSwitch.className = "switch";
    hcSwitch.setAttribute("role", "switch");
    hcSwitch.setAttribute("aria-label", "Handicaps");
    const syncHc = () => {
      const on = !!round.handicap;
      hcSwitch.textContent = on ? "On" : "Off";
      hcSwitch.classList.toggle("on", on);
      hcSwitch.setAttribute("aria-checked", String(on));
    };
    if (!isClub && !round.handicap) { hcHint.textContent = "Club Members only."; hcSwitch.classList.add("locked-feature"); }
    hcSwitch.onclick = async () => {
      if (!isClub && !round.handicap) return needClub("handicaps");
      const on = !round.handicap;
      const { error } = await db.from("rounds").update({ handicap: on }).eq("id", round.id);
      if (error) { toast(error.message); return; }
      round.handicap = on;
      syncHc();
      if (on && me && !me.usual_score) {
        const mineHc = await myHandicap();
        if (mineHc) await db.from("players").update({ usual_score: mineHc.usual, hcp: mineHc.hcp }).eq("id", me.id);
      }
      refresh();
    };
    hcRow.append(hcTxt, hcSwitch);
    if (round.mini) hcRow.style.display = "none";
    hostArea.append(hcRow);
    syncHc();
    syncOd();

    const courseArea = document.createElement("div");
    courseArea.className = "course-only";
    const cCurrent = document.createElement("div");
    const cSearch = document.createElement("input");
    cSearch.type = "search";
    cSearch.placeholder = "Search courses";
    cSearch.className = "course-search";
    cSearch.autocomplete = "off";
    const cResults = document.createElement("ul");
    cResults.className = "player-list course-results";
    const cManual = document.createElement("button");
    cManual.className = "btn-ghost";
    cManual.textContent = "Enter the pars myself";
    cManual.style.cssText = "width:100%;margin-top:10px";
    const cSkip = document.createElement("button");
    cSkip.className = "link-btn";
    cSkip.textContent = "Skip, no course";
    cSkip.style.marginTop = "10px";
    const cFile = document.createElement("input");
    cFile.type = "file";
    cFile.accept = "image/*";
    cFile.hidden = true;
    const cScan = document.createElement("button");
    cScan.className = "btn-ghost";
    cScan.textContent = "Scan a scorecard photo";
    cScan.style.cssText = "width:100%;margin-top:10px";
    cScan.onclick = () => cFile.click();
    cFile.onchange = async () => {
      const file = cFile.files[0];
      cFile.value = "";
      if (!file) return;
      cScan.disabled = true;
      cScan.textContent = "Reading scorecard...";
      try {
        const image = await shrinkImage(file);
        const { data: { session } } = await db.auth.getSession();
        const r = await fetch("/.netlify/functions/scan", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + (session ? session.access_token : "") },
          body: JSON.stringify(round.mini ? { image, mini: true } : { image })
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(out.error || "Couldn't read that one. Try a clearer photo.");
        if (round.mini) {
          const m = await parsModal({ mini: true, name: out.name, pars: out.pars });
          if (m) saveCourse({ ...m, source: "photo" });
          return;
        }
        let tee = null;
        if (out.tees && out.tees.length > 1) {
          tee = await teeModal(out.name || "Your scorecard", out.tees);
          if (tee === undefined) return;
        } else if (out.tees && out.tees.length) tee = out.tees[0];
        const m = await parsModal({ name: out.name, location: out.location, tee_name: tee ? teeLabel(tee) : "", pars: out.pars, hcp_index: out.hcp_index });
        if (!m) return;
        saveCourse({ ...m, source: "photo", ...teeDifficulty(tee, out.tees) });
      } catch (e) {
        toast(e.message || "Couldn't read that one. Try a clearer photo.");
      } finally {
        cScan.disabled = false;
        cScan.textContent = round.mini ? "Scan the scorecard" : "Scan a scorecard photo";
      }
    };
    if (round.mini) courseArea.append(h3("What mini-golf course?"), cCurrent, cScan, cManual, cFile, cSkip);
    else courseArea.append(h3("What course are you playing?"), cCurrent, cSearch, cResults, cManual, cScan, cFile, cSkip);
    hostArea.append(courseArea);
    const parTotal = c => c.pars.reduce((a, b) => a + b, 0);
    const courseLabel = c => c.name + (c.tee_name ? " (" + c.tee_name + " tees)" : "");
    function renderCourseCurrent() {
      cCurrent.innerHTML = "";
      if (!course) return;
      const p = document.createElement("p");
      p.className = "waiting";
      p.textContent = "Playing " + courseLabel(course) + ", par " + parTotal(course) + ".";
      const keep = document.createElement("button");
      keep.textContent = "Keep this course";
      keep.style.cssText = "width:100%;margin-bottom:12px";
      keep.onclick = () => setStep("size");
      cCurrent.append(p, keep);
    }
    async function selectCourse(c) {
      const { error } = await db.from("rounds").update({ course_id: c.id }).eq("id", round.id);
      if (error) { toast(error.message); return; }
      round.course_id = c.id;
      course = c;
      ROUND_RANKS[round.id] = Array.isArray(c.hcp_index) && c.hcp_index.length === 18 ? c.hcp_index : null;
      ROUND_HOLES[round.id] = round.mini && c.pars.length === 9 ? 9 : 18;
      renderCourseCurrent();
      setStep("confirm");
    }
    let searchTimer = null, searchSeq = 0;
    const courseRow = (title, detail, onclick) => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      const left = document.createElement("div");
      const nm = document.createElement("span");
      nm.textContent = title;
      const d = document.createElement("span");
      d.className = "detail";
      d.textContent = detail;
      left.append(nm, d);
      li.append(left);
      li.onclick = onclick;
      return li;
    };
    const note = (text, cls) => {
      const li = document.createElement("li");
      li.className = cls || "waiting";
      li.textContent = text;
      return li;
    };
    async function apiSearch(q) {
      try {
        const r = await authedFetch("/.netlify/functions/courses?q=" + encodeURIComponent(q));
        return r.ok ? ((await r.json()).courses || []) : [];
      } catch (e) { return []; }
    }
    async function saveCourse(row) {
      if (guestCard()) {
        if (await keepCardOnRound(row)) { renderCourseCurrent(); setStep("confirm"); }
        return;
      }
      const { data, error } = await db.from("courses").insert(row).select().single();
      if (error) { toast(error.message); return; }
      selectCourse(data);
    }
    async function pickApiCourse(c) {
      toast("Grabbing the scorecard...");
      let d = null;
      try {
        const r = await authedFetch("/.netlify/functions/courses?id=" + encodeURIComponent(c.id) + "&v=2");
        if (r.ok) d = await r.json();
      } catch (e) {}
      const location = [(c.city || "").trim(), c.state].filter(Boolean).join(", ") || null;
      const card = d && Array.isArray(d.scorecard) ? d.scorecard.slice().sort((a, b) => a.hole - b.hole) : [];
      const pars = card.length === 18 ? card.map(h => Number(h.par)) : null;
      if (!pars || pars.some(p => !(p >= 3 && p <= 6))) {
        // Point them at the scanner instead of opening the par entry right away
        guide.say(CRABBY_LINES.noCard);
        return;
      }
      const hcps = card.map(h => Number(h.handicap ?? h.hcp));
      const hcp_index = hcps.every(n => n >= 1 && n <= 18) && new Set(hcps).size === 18 ? hcps : null;
      let tee = null;
      if (d.tees && d.tees.length) {
        tee = await teeModal(d.name || c.name, d.tees);
        if (tee === undefined) return;
      }
      const tee_name = tee ? teeLabel(tee) : null;
      const { data: have } = await db.from("courses").select("*").eq("source", "api").eq("external_id", c.id);
      const matches = (have || []).filter(x => (x.tee_name || null) === tee_name && x.pars.join() === pars.join()
        && (x.created_by === user.id || !x.hcp_index));
      const match = hcp_index ? matches.find(x => x.hcp_index && x.hcp_index.join() === hcp_index.join())
        : (matches.find(x => x.hcp_index) || matches[0]);
      const base = match || {
        name: d.name || c.name, location, tee_name, pars, hcp_index,
        ...teeDifficulty(tee, d.tees),
        source: "api", external_id: c.id
      };
      if (!base.hcp_index) {
        const pick = await pickFrom("This scorecard doesn't list hole handicaps. Add them so handicap strokes land on the right holes?", [
          { label: "Add hole handicaps", value: "add" },
          { label: "Skip, spread strokes evenly", value: "skip" }
        ]);
        if (pick == null) return;
        if (pick === "add") {
          const m = await parsModal({ name: base.name, location: base.location, tee_name: base.tee_name, pars: base.pars, showHcp: true });
          if (m) {
            saveCourse({ ...m, ...teeDifficulty(tee, d.tees), source: "api", external_id: c.id });
            return;
          }
        }
      }
      if (match) { selectCourse(match); return; }
      saveCourse(base);
    }
    cSearch.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        const q = cSearch.value.trim();
        const seq = ++searchSeq;
        cResults.innerHTML = "";
        if (q.length < 3) return;
        cResults.append(note("Searching..."));
        const [own, ext] = await Promise.all([
          db.from("courses").select("*").neq("source", "api").eq("mini", false).eq("created_by", user.id).ilike("name", "%" + q.replace(/[%_\\]/g, "") + "%")
            .order("created_at", { ascending: false }).limit(5),
          apiSearch(q)
        ]);
        if (seq !== searchSeq) return;
        cResults.innerHTML = "";
        const mine = own.data || [];
        mine.forEach(c => cResults.append(courseRow(courseLabel(c),
          [c.location, "Par " + parTotal(c)].filter(Boolean).join(", "), () => selectCourse(c))));
        ext.forEach(c => cResults.append(courseRow(c.name,
          [[(c.city || "").trim(), c.state].filter(Boolean).join(", "), c.par ? "Par " + c.par : ""].filter(Boolean).join(", "),
          () => pickApiCourse(c))));
        if (!mine.length && !ext.length) cResults.append(note("No courses found. Enter the pars yourself below."));
        if (ext.length) cResults.append(note("Course data © OpenStreetMap contributors via OpenGolfAPI", "course-attrib"));
      }, 300);
    };
    cManual.onclick = async () => {
      const c = await parsModal(round.mini ? { mini: true, name: "" } : cSearch.value.trim());
      if (c) saveCourse(c);
    };
    cSkip.onclick = () => setStep("size");
    if (round.mini) {
      cScan.textContent = "Scan the scorecard";
      cManual.textContent = "Enter holes manually";
      cScan.style.marginTop = "0";
      cSkip.textContent = "Skip, no scorecard";
    }
    // Course lookup, the scanner and typing in pars are Club perks. Everyone else gets Skip.
    if (!isClub) {
      cSearch.readOnly = true;
      cSearch.placeholder = "\u{1F512} Course lookup is for Club Members";
      cSearch.classList.add("locked-feature");
      cSearch.onclick = () => needClub("course lookup");
      cSearch.oninput = null;
      cScan.onclick = () => needClub("the scorecard reader");
      cManual.onclick = () => needClub(round.mini ? "entering holes" : "entering pars");
      [cScan, cManual].forEach(b => b.classList.add("locked-feature"));
    }

    const confirmArea = document.createElement("div");
    confirmArea.className = "confirm-only";
    hostArea.append(confirmArea);
    function renderConfirm() {
      confirmArea.innerHTML = "";
      if (!course) { setStep("size"); return; }
      const c = course;
      const mkEl = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
      confirmArea.append(h3("Is this right?"));
      confirmArea.append(mkEl("p", "confirm-name", courseLabel(c)));
      const facts = [c.location, c.rating && c.slope ? "Rating " + c.rating + " / Slope " + c.slope : null,
        c.yardage ? c.yardage.toLocaleString() + " yds" : null].filter(Boolean).join(" \u00B7 ");
      if (facts) confirmArea.append(mkEl("p", "waiting", facts));
      const hasHcp = Array.isArray(c.hcp_index) && c.hcp_index.length === 18;
      const sum = (a, b, e) => a.slice(b, e).reduce((x, y) => x + (y || 0), 0);
      const nineOnly = c.pars.length === 9;
      (nineOnly ? [[0, 9, "Tot"]] : [[0, 9, "Out"], [9, 18, "In"]]).forEach(([b, e, label]) => {
        const wrap = mkEl("div", "sc-wrap");
        const t = mkEl("table", "sc-table confirm-table");
        const row = (head, vals, tot, cls) => {
          const tr = mkEl("tr", cls);
          tr.append(mkEl("td", null, head));
          vals.forEach(v => tr.append(mkEl("td", null, v == null ? "-" : String(v))));
          tr.append(mkEl("td", "tot", tot));
          t.append(tr);
        };
        row("Hole", Array.from({ length: 9 }, (_, i) => b + i + 1), label, "sc-meta");
        row("Par", c.pars.slice(b, e), String(sum(c.pars, b, e)));
        if (hasHcp) row("Hdcp", c.hcp_index.slice(b, e), "", "sc-meta");
        wrap.append(t);
        confirmArea.append(wrap);
      });
      confirmArea.append(mkEl("p", "waiting", (nineOnly ? "9 holes, total par " : "Total par ") + sum(c.pars, 0, 18)
        + (hasHcp || c.mini ? "" : ". No hole handicaps, so strokes spread evenly.")));
      const ok = mkEl("button", null, "Looks right");
      ok.style.cssText = "width:100%;margin-top:12px";
      ok.onclick = () => setStep("size");
      const fix = mkEl("button", "btn-ghost", "Fix something");
      fix.style.cssText = "width:100%;margin-top:10px";
      fix.onclick = async () => {
        if (c.mini) {
          const m = await parsModal({ mini: true, name: c.name, pars: c.pars });
          if (m) saveCourse({ ...m, source: c.source || "manual" });
          return;
        }
        const m = await parsModal({ name: c.name, location: c.location, tee_name: c.tee_name, pars: c.pars, hcp_index: c.hcp_index, showHcp: true });
        if (!m) return;
        saveCourse({ ...m, rating: c.rating, slope: c.slope, yardage: c.yardage, tee_gender: c.tee_gender,
          rating_source: c.rating_source, external_id: c.external_id, source: c.source || "manual" });
      };
      const other = mkEl("button", "link-btn", "Pick a different course");
      other.style.marginTop = "12px";
      other.onclick = () => setStep("course");
      const combo = c.name.match(/^(\S+) (\S+) (At .+)$/);
      const swapName = combo ? combo[2] + " " + combo[1] + " " + combo[3]
        : /\(back nine first\)$/.test(c.name) ? c.name.replace(/ \(back nine first\)$/, "") : c.name + " (back nine first)";
      const swap = mkEl("button", "btn-ghost", "Swap the nines" + (combo ? " (play " + combo[2] + " first)" : " (start on 10)"));
      swap.style.cssText = "width:100%;margin-top:10px";
      swap.onclick = () => {
        const flip = arr => (Array.isArray(arr) && arr.length === 18 ? arr.slice(9).concat(arr.slice(0, 9)) : null);
        saveCourse({ name: swapName, location: c.location, tee_name: c.tee_name, pars: flip(c.pars), hcp_index: flip(c.hcp_index),
          rating: c.rating, slope: c.slope, yardage: c.yardage, tee_gender: c.tee_gender, rating_source: c.rating_source,
          external_id: c.external_id, source: c.source || "manual", ...(c.mini ? { mini: true } : {}) });
      };
      confirmArea.append(ok, fix);
      if (!nineOnly) confirmArea.append(swap);
      confirmArea.append(other);
    }

    const mullArea = document.createElement("div");
    mullArea.className = "settings-only toggle-row od-row";
    const mullTxt = document.createElement("div");
    const mullLbl = document.createElement("span");
    mullLbl.className = "field-label";
    mullLbl.textContent = "Mulligans per player";
    const mullHint = document.createElement("small");
    mullHint.textContent = "Free do-overs. Players tap Use a mulligan on the hole.";
    mullTxt.append(mullLbl, mullHint);
    const mullStep = document.createElement("div");
    mullStep.className = "stepper";
    const mullDown = document.createElement("button");
    mullDown.className = "mini";
    mullDown.textContent = "\u2212";
    mullDown.setAttribute("aria-label", "Fewer mulligans");
    const mullVal = document.createElement("b");
    const mullUp = document.createElement("button");
    mullUp.className = "mini";
    mullUp.textContent = "+";
    mullUp.setAttribute("aria-label", "More mulligans");
    mullStep.append(mullDown, mullVal, mullUp);
    mullArea.append(mullTxt, mullStep);
    const drawMull = () => {
      const v = round.mulligans || 0;
      mullVal.textContent = v;
      mullDown.disabled = v <= 0;
      mullUp.disabled = v >= 9;
      mullArea.style.display = round.mode === "caddy" ? "none" : "";
    };
    if (!isClub) { mullHint.textContent = "Club Members only."; mullStep.classList.add("locked-feature"); }
    const setMull = async (d) => {
      if (!isClub && d > 0) return needClub("mulligans");
      const v = Math.max(0, Math.min(9, (round.mulligans || 0) + d));
      if (v === (round.mulligans || 0)) return;
      round.mulligans = v;
      drawMull();
      const { error } = await db.from("rounds").update({ mulligans: v }).eq("id", round.id);
      if (error) toast(error.message);
    };
    mullDown.onclick = () => setMull(-1);
    mullUp.onclick = () => setMull(1);

    // Nassau presses, stored on rounds.nassau_presses
    const pressRow = document.createElement("div");
    pressRow.className = "toggle-row od-row settings-only";
    const pressTxt = document.createElement("div");
    const pressLabel = document.createElement("span");
    pressLabel.className = "field-label";
    pressLabel.textContent = "Presses";
    const pressHint = document.createElement("small");
    pressHint.textContent = "Go 2 down in a nine and a new 1-point bet starts on the next hole. Chase it back.";
    pressTxt.append(pressLabel, pressHint);
    const pressSwitch = document.createElement("button");
    pressSwitch.type = "button";
    pressSwitch.className = "switch";
    pressSwitch.setAttribute("role", "switch");
    pressSwitch.setAttribute("aria-label", "Presses");
    pressRow.append(pressTxt, pressSwitch);
    const syncPress = () => {
      const on = !!round.nassau_presses;
      pressSwitch.textContent = on ? "On" : "Off";
      pressSwitch.classList.toggle("on", on);
      pressSwitch.setAttribute("aria-checked", String(on));
      pressRow.style.display = pickedMode === "nassau" ? "" : "none";
    };
    pressSwitch.onclick = async () => {
      if (!isClub && !round.nassau_presses) return needClub("presses");
      const on = !round.nassau_presses;
      const { error } = await db.from("rounds").update({ nassau_presses: on }).eq("id", round.id);
      if (error) { toast(error.message); return; }
      round.nassau_presses = on;
      syncPress();
    };
    hostArea.append(pressRow);

    // Sixes: Nassau bets and its options, stored on rounds.sixes_nassau, sixes_presses, sixes_birdie and sixes_second_ball.
    // 18 holes only. The options sit under Nassau bets and only show while it's on.
    const sixesRows = [
      ["sixes_nassau", "Nassau bets", "Each 6-hole set becomes three 1-point bets: its first 3 holes, its last 3, and all 6."],
      ["sixes_presses", "Presses", "Go 2 down in a bet and a new 1-point bet starts on the next hole."],
      ["sixes_birdie", "Birdie bonus", "A gross birdie is +1 point for you and your partner."],
      ["sixes_second_ball", "Second-ball tiebreak", "Best balls tie? The better other ball wins the hole."],
    ].map(([key, label, hint], i) => {
      const row = document.createElement("div");
      row.className = "toggle-row od-row settings-only" + (i ? " sub-toggle" : "");
      const txt = document.createElement("div");
      const lab = document.createElement("span");
      lab.className = "field-label";
      lab.textContent = label;
      const small = document.createElement("small");
      small.textContent = hint;
      txt.append(lab, small);
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "switch";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-label", label);
      row.append(txt, sw);
      sw.onclick = async () => {
        if (!isClub && !round[key]) return needClub("Nassau bets");
        const on = !round[key];
        const { error } = await db.from("rounds").update({ [key]: on }).eq("id", round.id);
        if (error) { toast(error.message); return; }
        round[key] = on;
        syncSixes();
      };
      hostArea.append(row);
      return { key, row, sw };
    });
    function syncSixes() {
      const shown = pickedMode === "sixes" && holesIn(round) === 18;
      sixesRows.forEach(({ key, row, sw }, i) => {
        const on = !!round[key];
        sw.textContent = on ? "On" : "Off";
        sw.classList.toggle("on", on);
        sw.setAttribute("aria-checked", String(on));
        row.style.display = shown && (!i || round.sixes_nassau) ? "" : "none";
      });
    }

    const sizeTitle = h3("How many players?");
    hostArea.append(sizeTitle, sizeArea, modeArea);
    sizeTitle.classList.add("size-only");
    sizeArea.classList.add("size-only");
    modeArea.classList.add("mode-only");

    const showSizeInfo = (key, label) => {
      RULES["size" + key] = [{ h: label, p: [SIZE_NOTES[key]] }].concat(modesFor(key).map(k => ({
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
      const list = modesFor(key);
      d.textContent = key === "1" ? "Kinda sad... but best for helping keep score" : list.length <= 3 ? list.map(k => MODES[k].name).join(", ") : list.length + " game modes";
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
      const picker = modeGrid({ modes: modesFor(pickedSize), selected: pickedMode, off: modeLock(), info: modeRules, onLocked: lockedMode, onPick: key => {
        pickedMode = key;
        updateStart();
        caddyNote.style.display = key === "caddy" ? "block" : "none";
        nextBtn.disabled = false;
        guide.say(guideLine());
        renderLobbyList();
      } });
      modeArea.append(picker.el);
      const caddyNote = document.createElement("p");
      caddyNote.className = "waiting";
      caddyNote.style.display = pickedMode === "caddy" ? "block" : "none";
      caddyNote.textContent = "Next, you'll set who's golfing and who's caddying.";
      modeArea.append(caddyNote);
      const nextBtn = document.createElement("button");
      nextBtn.textContent = "Next: settings";
      nextBtn.style.cssText = "width:100%;margin-top:14px";
      nextBtn.disabled = !pickedMode;
      nextBtn.onclick = () => setStep("setup");
      modeArea.append(nextBtn);
      picker.fit();
    }

    function updateStart() {
      const n = players.length;
      if ($("money-switch")) syncMoney();
      syncHc();
      syncPress();
      syncSixes();
      odNote.style.display = oneDevice && new Set(players.map(p => p.group_no)).size > 1 ? "block" : "none";
      startBtn.disabled = true;
      if (!pickedSize) { startBtn.textContent = "Pick how many are playing"; return; }
      if (!pickedMode) { startBtn.textContent = "Pick a mode to start"; return; }
      if (!sizeFits[pickedSize](n)) {
        const need = pickedSize === "5" ? 5 : +pickedSize;
        startBtn.textContent = n < need ? "Waiting for " + (need - n) + " more" : "Too many players for " + pickedSize;
        return;
      }
      if (round.handicap) {
        const noHc = players.filter(pl => !pl.usual_score && pl.role !== "caddy");
        if (noHc.length) { startBtn.textContent = "Add handicaps for " + noHc.map(pl => pl.name).join(", "); return; }
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
    const stepSettings = document.createElement("button");
    stepSettings.className = "link-btn";
    stepSettings.textContent = "Change settings";
    stepSettings.onclick = () => setStep("setup");
    stepBar.append(stepBack, stepSettings, stepSummary);
    lobby.prepend(stepBar);
    function guideLine() {
      const st = lobby.dataset.step;
      if (st === "course") return round.mini ? (isClub ? CRABBY_LINES.courseMini : CRABBY_LINES.courseMiniGuest)
        : isClub ? CRABBY_LINES.course : CRABBY_LINES.courseGuest;
      if (st === "confirm") return course && !course.mini && !(Array.isArray(course.hcp_index) && course.hcp_index.length === 18)
        ? CRABBY_LINES.confirmNoHcp : CRABBY_LINES.confirm;
      if (st === "size") return CRABBY_LINES.size;
      if (st === "setup") return CRABBY_LINES.setup;
      if (st === "mode") return pickedMode ? CRABBY_LINES.modePicked : CRABBY_LINES.mode;
      if (startBtn.disabled) {
        const need = pickedSize === "5" ? 5 : +pickedSize;
        return players.length < need ? CRABBY_LINES.waitingPlayers : CRABBY_LINES.tooMany;
      }
      if (teamsPicked() && [...new Set(players.map(pl => pl.group_no))].some(g => !teamsOf(players, g).valid)) return CRABBY_LINES.teams;
      if (pickedMode === "caddy") {
        const caddies = players.filter(pl => pl.role === "caddy");
        if (!caddies.length || caddies.some(cd => !pairs.some(x => x.caddy_id === cd.id))) return CRABBY_LINES.caddy;
      }
      return CRABBY_LINES.ready;
    }

    let firstStep = true;
    function setStep(st, fromHistory) {
      const stepChanged = lobby.dataset.step !== st;
      lobby.dataset.step = st;
      placeSettings(st);
      if (stepChanged && lobby.isConnected) {
        window.scrollTo(0, 0);
        lobby.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "ease-out" });
      }
      if (!fromHistory) { if (firstStep) history.replaceState({ step: st }, ""); else history.pushState({ step: st }, ""); }
      window.__lobbyStep = setStep;
      if (st === "size") { sizeTitle.style.display = ""; sizeArea.style.display = ""; }
      if (st === "course") renderCourseCurrent();
      if (st === "confirm") renderConfirm();
      if (st === "room") renderRoomGame();
      guide.say(guideLine());
      if (st === "room" && pickedMode && pickedSize) {
        stepSummary.textContent = MODES[pickedMode].name + ", " + SIZES.find(([k]) => k === pickedSize)[1].toLowerCase() + (course ? ", " + course.name : "");
      }
      renderLobbyList();
      if (!firstStep) { slideIn(lobby); window.scrollTo(0, 0); }
      firstStep = false;
    }
    setStep("course");

    lobbyUpdateStart = () => { updateStart(); guide.say(guideLine()); if (lobby.dataset.step === "course") renderCourseCurrent(); placeSettings(lobby.dataset.step); drawMull(); };
    updateStart();

    startBtn.onclick = async () => {
      if (!pickedMode) return;
      if (round.handicap) {
        const missing = players.filter(pl => !pl.usual_score && pl.role !== "caddy");
        if (missing.length) { toast("Handicaps are on. Add a usual score for " + missing.map(pl => pl.name).join(", ") + "."); return; }
      }
      if (pickedMode === "stableford" && !course) { toast("Stableford needs a course so we know the pars. Go back and pick one."); return; }
      if (pickedMode === "wolf") {
        const sizes = {};
        players.forEach(pl => (sizes[pl.group_no] = (sizes[pl.group_no] || 0) + 1));
        if (!players.length || Object.values(sizes).some(n => n !== 3 && n !== 4)) { toast("Wolf needs 3 or 4 players in every group."); return; }
      }
      if (pickedMode === "sixes" && (players.length !== 4 || players.some(pl => pl.group_no !== players[0].group_no))) {
        toast("Sixes needs exactly 4 golfers in one group. You have " + players.length + "."); return;
      }
      if (pickedMode === "nassau") {
        if (holesIn(round) !== 18) { toast("Nassau needs 18 holes. Pick another game for a 9-hole card."); return; }
        if ((players.length !== 2 && players.length !== 4) || players.some(pl => pl.group_no !== players[0].group_no)) {
          toast("Nassau needs exactly 2 or 4 golfers in one group. You have " + players.length + "."); return;
        }
      }
      if (teamsPicked()) {
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
      if (stakes === "pot" && pickedSize === "5" && Math.round(num("m-count")) !== players.length) { mq("m-count").value = players.length; syncMoney(); }
      if (stakes === "pot" && potBox.problem()) { toast(potBox.problem()); return; }
      if (pickedMode === "wad") {
        const sizes = {};
        players.forEach(pl => (sizes[pl.group_no] = (sizes[pl.group_no] || 0) + 1));
        if (Object.values(sizes).some(n => n < 2 || n > 4)) { toast("Wad needs 2 to 4 players in every group."); return; }
        if (stakes !== "point") { toast("Turn on Play for money and set a dollar amount per Wad."); return; }
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
    money.className = "settings-only money-box";
    money.innerHTML = `
      <div class="toggle-row">
        <div><span class="field-label">Play for money</span><small>Parcade keeps track. You settle up yourselves.</small></div>
        <button type="button" class="switch" id="money-switch" role="switch" aria-label="Play for money"></button>
      </div>
      <div id="money-opts" style="display:none">
        <div class="chip-row" id="money-type">
          <button type="button" data-t="pot">Buy-in pot</button>
          <button type="button" data-t="point">Per point</button>
        </div>
        <label class="money-field" id="m-count-wrap" style="display:none"><span>How many players total?</span><input id="m-count" type="number" inputmode="numeric" min="5" max="64" step="1" placeholder="8"></label>
        <div id="money-pot"></div>
        <div id="money-point" style="display:none">
          <label class="money-field"><span id="m-unit">Dollars per point</span><input id="m-per" type="number" inputmode="decimal" min="0" step="0.5" placeholder="1"></label>
          <p class="cp-note">At the end, everyone settles the point difference with everyone else.</p>
        </div>
      </div>`;
    hostArea.append(money);
    const mq = (id) => money.querySelector("#" + id);
    const num = id => { const v = parseFloat(mq(id).value); return isNaN(v) || v < 0 ? 0 : Math.round(v * 100) / 100; };
    const expectedPlayers = () => (pickedSize === "5" ? Math.max(5, Math.round(num("m-count")) || 5) : (+pickedSize || 1));
    const payers = () => (pickedMode === "caddy" ? players.filter(pl => pl.role === "caddy").length : Math.max(players.length, expectedPlayers()));
    const potBox = potSetup({ payers, split: [60, 30, 10],
      payerText: n => n + (pickedMode === "caddy" ? (n === 1 ? " caddy" : " caddies") : (n === 1 ? " player" : " players")) });
    mq("money-pot").append(potBox.el);
    function syncMoney() {
      if (pickedMode === "wad" && stakes === "pot") stakes = "point";
      mq("money-type").querySelector('[data-t="pot"]').style.display = pickedMode === "wad" ? "none" : "";
      mq("money-point").querySelector(".cp-note").textContent = (MONEY_UNITS[pickedMode] || MONEY_UNITS.party).note;
      const on = stakes !== "none";
      const sw = mq("money-switch");
      sw.textContent = on ? "On" : "Off";
      sw.classList.toggle("on", on);
      sw.setAttribute("aria-checked", String(on));
      mq("money-opts").style.display = on ? "block" : "none";
      mq("money-type").querySelectorAll("button").forEach(b => b.classList.toggle("selected", b.dataset.t === stakes));
      mq("money-pot").style.display = stakes === "pot" ? "block" : "none";
      mq("m-count-wrap").style.display = stakes === "pot" && pickedSize === "5" && pickedMode !== "caddy" ? "" : "none";
      mq("money-point").style.display = stakes === "point" ? "block" : "none";
      mq("m-unit").textContent = "Dollars per " + (MONEY_UNITS[pickedMode] || MONEY_UNITS.party).unit;
      potBox.sync();
    }
    if (!isClub) mq("money-switch").classList.add("locked-feature");
    mq("money-switch").onclick = () => { if (!isClub) return needClub("Play for money"); stakes = stakes === "none" ? "pot" : "none"; syncMoney(); };
    mq("money-type").querySelectorAll("button").forEach(b => (b.onclick = () => { stakes = b.dataset.t; syncMoney(); }));
    mq("m-per").oninput = syncMoney;
    mq("m-count").oninput = syncMoney;
    const moneyFields = () => stakes === "pot"
      ? { stakes, buy_in: potBox.buyIn(), payouts: potBox.payouts(), per_point: null }
      : stakes === "point" ? { stakes, per_point: num("m-per"), buy_in: null, payouts: null }
      : { stakes: "none", buy_in: null, payouts: null, per_point: null };
    syncMoney();

    startBtn.classList.add("room-only");
    startBtn.style.marginTop = "14px";
    hostArea.append(startBtn);
  }

  // ---------- Game ----------
  const game = document.createElement("div");
  game.className = "game";
  game.style.display = "none";

  const card = document.createElement("div");
  card.style.cssText = "padding:16px;border-radius:14px;background:rgba(var(--hi-rgb),0.06)";
  card.innerHTML = `
    <div id="hole-strip" class="hole-strip"></div>
    <div class="hole-head"><b id="hole-label"></b><span id="hole-mine"></span></div>
    <div id="hole-info" class="hole-info"></div>
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
    <div id="mull-box" class="mull-box"></div>
    <div id="keeper-row" class="chip-row keeper-row"></div>
    <div id="wad-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Wad</div>
      <div id="wad-pot" class="ch-text"></div>
      <div id="wad-note" class="cp-note"></div>
      <div id="wad-log"></div>
    </div>
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
    <div id="sixes-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Sixes</div>
      <div id="sixes-teams" class="ch-text"></div>
      <div id="sixes-result" class="ch-winner"></div>
    </div>
    <div id="nassau-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Nassau</div>
      <div id="nassau-teams" class="ch-text"></div>
      <div id="nassau-status" class="nassau-status"></div>
      <div id="nassau-result" class="ch-winner"></div>
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
    <div id="stab-box" class="ch-box" style="display:none">
      <div class="ch-kicker">Stableford</div>
      <div id="stab-par" class="ch-text"></div>
      <div id="stab-result" class="ch-winner"></div>
    </div>
    <div id="recap-box" class="ch-box recap-inline" style="display:none"></div>
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
  [["hole", "Hole 1"], ["board", "Leaderboard"], ["chat", "Chat"], ["bets", "Bets"], ["course", "Course"], ["rules", "Rules"]].forEach(([key, label]) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.textContent = label;
    b.onclick = () => showTab(key);
    tabs.append(b);
    tabBtns[key] = b;
    panels[key] = document.createElement("div");
  });
  tabBtns.rules.classList.add("tab-small");
  tabBtns.course.classList.add("tab-small");
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
  const hcInfo = document.createElement("div");
  const cardsInfo = document.createElement("div");
  const sixesLine = document.createElement("p");
  sixesLine.className = "waiting sixes-line";
  sixesLine.style.cssText = "display:none;margin:0 0 8px";
  const nassauLine = document.createElement("div");
  nassauLine.className = "waiting nassau-line";
  nassauLine.style.cssText = "display:none;margin:0 0 8px";
  panels.board.append(stakesLine, sixesLine, nassauLine, board, cardsInfo, hcInfo);

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
    if (!hostClub) return round.host_id === user.id ? needClub("side bets") : toast("Side bets need a Club Member hosting the round.");
    if (!window.__signedIn) return needAccount("side bets");
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
      d.append(figureEl(pl), txt);
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
    if (key === "course") renderCoursePanel();
    if (key === "rules") { panels.rules.innerHTML = ""; renderRules(panels.rules, [RULES[round.mode] ? round.mode : "party", "round"], deckFor(round), holesIn(round), round.mini); }
    if (key === "chat") { unread = 0; updateChatTab(); setTimeout(() => (chatList.scrollTop = chatList.scrollHeight), 0); }
    Object.entries(panels).forEach(([k, el]) => (el.style.display = k === key ? "block" : "none"));
    Object.entries(tabBtns).forEach(([k, b]) => b.classList.toggle("active", k === key));
  }
  game.append(lateWrap, tabs, panels.hole, panels.board, panels.chat, panels.bets, panels.course, panels.rules);
  showTab("hole");
  let playedFinale = false;
  const scoreArea = document.createElement("div");
  scoreArea.style.display = "none";
  scoreArea.className = "results";
  const deleteArea = document.createElement("div");
  deleteArea.className = "danger-row";
  box.append(lobby, game, scoreArea, deleteArea);

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
  topBar.append(homeTop, copyTop, keeperWrap);
  if (round.tournament_id) {
    const { data: tourney } = await db.from("tournaments").select("code, schedule, holes_per_match").eq("id", round.tournament_id).maybeSingle();
    if (tourney) {
      const tourTop = document.createElement("button");
      tourTop.className = "copy-top";
      tourTop.textContent = "Bracket";
      tourTop.onclick = () => (location.href = "/?t=" + tourney.code);
      topBar.append(tourTop);
      const tNote = document.createElement("p");
      tNote.className = "waiting";
      tNote.style.cssText = "margin:0 0 12px";
      tNote.textContent = tourney.schedule === "one_day"
        ? "Tournament round. Play all 18. Your matches are scored on the bracket, a chunk of holes at a time."
        : tourney.holes_per_match === 9 ? "Tournament match, 9 holes. It's final after hole 9. The bracket has the team score."
        : "Tournament match. The bracket has the team score.";
      panels.hole.prepend(tNote);
    }
  }
  const roundSound = soundButton();
  roundSound.classList.add("sound-home");
  document.body.append(roundSound);
  document.body.append(topBar);

  // Best Ball and Vegas always pick teams. Nassau does when it's 2 vs 2.
  function teamsPicked() { return TEAM_MODES.includes(pickedMode) || (pickedMode === "nassau" && nassauTeamGame(players)); }

  function renderLobbyList() {
    const isLeader = round.host_id === user.id;
    const tournament = players.length > 4 || players.some(p => p.group_no > 1);
    const groupCount = Math.max(1, Math.ceil(players.length / 4), ...players.map(p => p.group_no));
    groupTools.style.display = isLeader && players.length > 4 ? "block" : "none";
    teamTools.style.display = isLeader && teamsPicked() ? "block" : "none";
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
          + (pl.team && pickedMode !== "sixes" && round.mode !== "sixes" && (pickedMode !== "nassau" || teamsPicked()) ? " (" + TEAM_NAMES[pl.team] + ")" : "")
          + (pickedMode === "sixes" && players.indexOf(pl) < 4 ? " (Player " + "ABCD"[players.indexOf(pl)] + ")" : "")
          + (pl.role === "caddy" ? " (caddy" + (pairs.some(x => x.caddy_id === pl.id)
              ? " for " + pairs.filter(x => x.caddy_id === pl.id).map(x => (players.find(g => g.id === x.golfer_id) || {}).name).filter(Boolean).join(", ")
              : "") + ")" : "")
          + (pl.user_id === user.id ? " (you)" : "");
        name.prepend(figureEl(pl));
        if (clubIds.has(pl.user_id)) name.append(clubBadge());
        li.append(name);
        if (round.handicap) {
          const txt = pl.hcp != null ? "Handicap " + pl.hcp : pl.usual_score ? "Shoots " + pl.usual_score : "Handicap ?";
          if (isLeader || pl.user_id === user.id) {
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
        if (round.handicap && pl.usual_score) {
          const st = document.createElement("span");
          st.className = "detail";
          st.style.width = "100%";
          st.textContent = strokeHolesText(holeAllowances(round, players)[pl.id] || 0);
          li.append(st);
        }
        if (isLeader && teamsPicked()) {
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
              b.append(figureEl(gp, 14), "Caddies for " + gp.name);
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
      { label: "Their name", placeholder: "What your crew calls them", max: 20 },
      { label: "Shirt color for this round", type: "colors", taken: players.map(p => p.color) }
    ], "Add");
    if (!vals) return;
    let hc = { usual: null, hcp: null };
    if (round.handicap) { hc = await askHandicap(vals[0]); if (!hc) return; }
    const pc = vals[1] === "-" ? null : vals[1];
    const { error } = await insertPlayer({
      round_id: round.id, user_id: null, name: vals[0],
      color: pc,
      usual_score: hc.usual,
      hcp: hc.hcp,
      outfit: { ...DEFAULT_OUTFIT, shirtColor: pc || DEFAULT_OUTFIT.shirtColor },
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
    const hc = await askHandicap(pl.name, { hcp: pl.hcp, usual: pl.usual_score });
    if (!hc) return;
    if (pl.user_id === user.id) saveMyHandicap(hc);
    const { error } = await db.from("players").update({ usual_score: hc.usual, hcp: hc.hcp }).eq("id", pl.id);
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
  let gone = false;
  async function refresh() {
    if (gone) return;
    const [r, p, sc, c, wp, cp, pr, mu, bt, wd] = await Promise.all([
      fetchRound(),
      db.from("players").select("*").eq("round_id", round.id).order("created_at"),
      db.from("scores").select("*").eq("round_id", round.id),
      db.from("challenge_results").select("*").eq("round_id", round.id),
      db.from("wolf_picks").select("*").eq("round_id", round.id),
      db.from("caddy_pairs").select("*").eq("round_id", round.id),
      db.from("predictions").select("*").eq("round_id", round.id),
      db.from("mulligans").select("*").eq("round_id", round.id),
      db.from("bets").select("*").eq("round_id", round.id).order("created_at"),
      db.from("wads").select("*").eq("round_id", round.id).order("created_at"),
    ]);
    if (gone) return;
    if (!r.error && !r.data) { gone = true; showDeleted(box, "round"); return; }
    if (r.data) round = r.data;
    if (round.course_id && (!course || course.id !== round.course_id)) {
      const { data: cd } = await db.from("courses").select("*").eq("id", round.course_id).maybeSingle();
      course = cd || null;
    } else if (!round.course_id && round.mini_course) course = cardOnRound();
    ROUND_RANKS[round.id] = course && course.id === round.course_id && Array.isArray(course.hcp_index)
      && course.hcp_index.length === 18 ? course.hcp_index : null;
    ROUND_HOLES[round.id] = round.mini && course && course.id === round.course_id && course.pars.length === 9 ? 9 : 18;
    const { data: pmData } = await db.from("player_mulligans").select("*").eq("round_id", round.id);
    pmulls = pmData || [];
    players = p.data || [];
    scores = sc.data || [];
    results = c.data || [];
    picks = (wp && wp.data) || [];
    pairs = (cp && cp.data) || [];
    preds = (pr && pr.data) || [];
    mulls = (mu && mu.data) || [];
    bets = (bt && bt.data) || [];
    wads = (wd && wd.data) || [];
    me = players.find(pl => pl.user_id === user.id) || null;
    render();
    checkClubBadges();
  }

  // Club Member badges: look each account in the round up once
  async function checkClubBadges() {
    const ids = [...new Set(players.map(pl => pl.user_id).filter(id => id && !clubChecked.has(id)))];
    if (!ids.length) return;
    ids.forEach(id => clubChecked.add(id));
    const { data } = await db.rpc("club_members", { p_users: ids });
    if (Array.isArray(data) && data.length) { data.forEach(id => clubIds.add(id)); if (!gone) render(); }
  }

  function render() {
    const playing = round.status === "playing";
    const finished = round.status === "finished";
    lobby.style.display = round.status === "lobby" ? "block" : "none";
    game.style.display = playing ? "block" : "none";
    document.body.classList.toggle("has-rail", playing);
    Sound.music(!playing);
    if (finished && !playedFinale) {
      playedFinale = true;
      Sound.play("fanfare");
      db.rpc("claim_round_coin", { p_round: round.id }).then(({ data }) => {
        if (!data) return;
        const modeName = (MODES[data.mode] || {}).name || "this mode";
        const bits = [];
        if (data.coin) bits.push("+1 coin for finishing " + holesIn(round) + " holes");
        if (data.bonus) bits.push("+" + data.bonus + " bonus for your first round of " + modeName + "!");
        if (bits.length) { setTimeout(() => Sound.play("coin"), 900); toast(bits.join(" ") + " \u{1FA99}", true); }
        else if (data.daily) toast("You already earned today's round coin. Come back tomorrow.");
        if (typeof loadShop === "function") loadShop(true);
      });
    }
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
    requestAnimationFrame(() => { document.body.style.paddingTop = "calc(" + (topBar.offsetHeight + 20) + "px + env(safe-area-inset-top, 0px))"; });
    scoreArea.style.display = finished ? "block" : "none";
    if (finished) renderScorecard(scoreArea, { round, players, scores, results, user, picks, preds, mulls, bets, wads, course });
      if (me && round.host_id === user.id) {
        const golfers = players.filter(p => p.role !== "caddy");
        const allDone = golfers.length && golfers.every(p => scores.some(x => x.player_id === p.id && x.hole === holesIn(round) && x.strokes));
        if (!allDone) {
          const cont = document.createElement("button");
          cont.textContent = "Continue round";
          cont.style.cssText = "width:100%;margin:8px 0 18px";
          cont.onclick = async () => {
            cont.disabled = true;
            const gp = golfers.filter(p => p.group_no === me.group_no);
            const mine = scores.filter(x => x.strokes && gp.some(p => p.id === x.player_id));
            const last = mine.length ? Math.max(...mine.map(x => x.hole)) : 0;
            const done = last && gp.every(p => mine.some(x => x.player_id === p.id && x.hole === last));
            const target = !last ? 1 : done ? Math.min(last + 1, holesIn(round)) : last;
            const { error } = await db.from("rounds").update({ status: "playing" }).eq("id", round.id);
            if (error) { toast(error.message); cont.disabled = false; return; }
            round.status = "playing";
            db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto",
              body: "\u26F3 Round's back on. Picking up on hole " + target + "." }).then(() => {});
            await refresh();
            setHole(target);
            showTab("hole");
          };
          scoreArea.prepend(cont);
        }
      }
    sub.textContent = finished ? "Final results" : playing
      ? (MODES[round.mode] || MODES.party).name + (round.handicap ? " with handicaps" : "") + (course ? " at " + course.name : "")
      : "Round code: " + round.code + (round.handicap ? ", handicaps on" : "");
    renderLobbyList();
    if (lobbyUpdateStart) lobbyUpdateStart();
    if (round.host_id !== user.id) guide.say(me ? CRABBY_LINES.joined : CRABBY_LINES.joiner);
    join.style.display = me ? "none" : "block";
    rejoinBtn.style.display = !me && players.length ? "inline-block" : "none";
    if (playing) renderGame();
    renderDelete();
  }

  function renderDelete() {
    deleteArea.innerHTML = "";
    if (round.host_id !== user.id || round.status === "playing") return;
    const del = document.createElement("button");
    del.className = "link-btn danger";
    del.textContent = "Delete this round";
    del.onclick = deleteRound;
    deleteArea.append(del);
  }

  async function deleteRound() {
    const { data: n } = await db.rpc("round_season_count", { p_round: round.id });
    const note = "Scores, chat and bets are gone for everyone. This can't be undone." +
      (n > 0 ? " It's counted in " + n + (n === 1 ? " season" : " seasons") + ", so those standings will change." : "");
    const ok = await ask("Delete " + round.name + "?", [], "Delete round", note, async () => {
      const { error } = await db.rpc("delete_round", { p_round: round.id });
      return error ? error.message : null;
    });
    if (!ok) return;
    gone = true;
    location.href = "/";
  }

  function renderGame() {
    const played = scores.filter(x => x.strokes);
    const allow = holeAllowances(round, players);
    const wolfTot = isWolf() ? wolfTotals(round, players, scores, picks) : {};
    const skinTot = isSkins() ? skinsState(round, players, scores).totals : {};
    const matchWon = isMatch() ? matchTotals(round, players, scores) : {};
    const bestTot = isBest() ? bestBallTotals(round, players, scores) : {};
    const vegasTot = isVegas() ? vegasTotals(round, players, scores) : {};
    const sixesTot = isSixes() ? sixesTotals(round, players, scores, false, course) : {};
    const nassauTot = isNassau() ? nassauTotals(round, players, scores) : {};
    const wadHold = isWad() ? wadHolders(players, wads) : new Set();
    const stabTot = isStab() ? stablefordTotals(round, players, scores, course) : {};
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
      if (isSixes()) pts = sixesTot[pl.id] || 0;
      if (isNassau()) pts = nassauTot[pl.id] || 0;
      if (isWad()) pts = wads.filter(w => w.player_id === pl.id).length;
      if (isStab()) pts = stabTot[pl.id] || 0;
      return { pl, pts, total, net: total - Math.floor(mine.length * (allow[pl.id] || 0) + 1e-9), thru: mine.length };
    });
    if (isParty() || isWolf() || isSkins() || isMatch() || isBbb() || isBest() || isVegas() || isWad() || isStab()) rows.sort((a, b) => b.pts - a.pts);
    else if (isSixes() || isNassau()) {
      const rank = isSixes() ? sixesRankValues(round, players, scores, false, course) : nassauRankValues(round, players, scores);
      rows.sort((a, b) => (rank[b.pl.id] || 0) - (rank[a.pl.id] || 0));
    }
    else { const avg = r => (r.thru ? r.net / r.thru : Infinity); rows.sort((a, b) => avg(a) - avg(b)); }
    if (isWad()) rows.sort((a, b) => (wadHold.has(b.pl.id) - wadHold.has(a.pl.id)) || b.pts - a.pts);

    board.innerHTML = "";
    sixesLine.style.display = isSixes() ? "block" : "none";
    if (isSixes()) sixesLine.textContent = sixesNowText(me ? me.group_no : 1);
    nassauLine.style.display = isNassau() ? "block" : "none";
    if (isNassau()) drawNassauLines(nassauLine, me ? me.group_no : 1);
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.append((i + 1) + ". ", figureEl(r.pl), r.pl.name + (r.pl.user_id === user.id ? " (you)" : ""));
      if (clubIds.has(r.pl.user_id)) name.append(clubBadge());
      const val = document.createElement("span");
      val.textContent = isSixes() || isNassau() ? sixesPts(r.pts) + (r.pts === 1 ? " pt" : " pts")
        : (isParty() || isWolf() || isSkins() || isMatch() || isBbb() || isBest() || isVegas() || isWad() || isStab())
        ? r.pts + (isSkins() ? (r.pts === 1 ? " skin" : " skins") : isMatch() ? (r.pts === 1 ? " pt" : " pts") : isWad() ? " made" : " pts")
        : (r.thru ? r.total + " strokes" + (round.handicap ? ", net " + Math.round(r.net) : "") + " (thru " + r.thru + ")" : "-");
      if (isWad() && wadHold.has(r.pl.id)) val.prepend("💰 ");
      if ((isParty() || isWolf() || isSkins() || isMatch() || isBbb() || isBest() || isVegas() || isSixes() || isNassau() || isWad() || isStab()) && r.thru) {
        const sub = document.createElement("span");
        sub.className = "sub-score";
        sub.textContent = " (" + r.total + " thru " + r.thru + ")";
        val.append(sub);
      }
      li.append(name, val);
      board.appendChild(li);
    });

    cardsInfo.innerHTML = "";
    const gnums = [...new Set(players.map(p => p.group_no))].sort((a, b) => a - b);
    const ch3 = document.createElement("h3");
    ch3.textContent = "Scorecards";
    if (round.mini) ch3.append(" ", MINI_TAG());
    cardsInfo.append(ch3);
    gnums.forEach(g => {
      const gp = players.filter(p => p.group_no === g && p.role !== "caddy");
      if (!gp.length) return;
      const sc = scores.filter(x => x.strokes && gp.some(p => p.id === x.player_id));
      const maxH = sc.length ? Math.max(...sc.map(x => x.hole)) : 0;
      let cur = 1;
      while (cur < holesIn(round) && gp.every(p => sc.some(x => x.player_id === p.id && x.hole === cur))) cur++;
      const lbl = document.createElement("p");
      lbl.className = "waiting";
      lbl.style.margin = "8px 0 4px";
      lbl.textContent = (gnums.length > 1 ? "Group " + g + ", " : "") + (maxH ? "on hole " + cur : "hasn't teed off yet");
      cardsInfo.append(lbl);
      if (!maxH) return;
      const wrap = document.createElement("div");
      wrap.className = "sc-wrap";
      const table = document.createElement("table");
      table.className = "sc-table";
      const head = document.createElement("tr");
      const cell = (tag, text, cls) => { const c = document.createElement(tag); c.textContent = text; if (cls) c.className = cls; return c; };
      head.append(cell("th", ""));
      for (let hn = 1; hn <= maxH; hn++) head.append(cell("th", String(hn)));
      head.append(cell("th", "Tot"));
      table.append(head);
      if (course && Array.isArray(course.pars)) {
        const metaRow = (label, vals, total) => {
          const tr = document.createElement("tr");
          tr.className = "sc-meta";
          tr.append(cell("td", label));
          for (let hn = 1; hn <= maxH; hn++) tr.append(cell("td", vals[hn - 1] != null ? String(vals[hn - 1]) : "-"));
          tr.append(cell("td", total, "tot"));
          table.append(tr);
        };
        const sumTo = (arr) => String(arr.slice(0, maxH).reduce((a, b) => a + (b || 0), 0));
        metaRow("Par", course.pars, sumTo(course.pars));
        if (Array.isArray(course.yardages) && course.yardages.length === 18) metaRow("Yds", course.yardages, sumTo(course.yardages));
        if (Array.isArray(course.hcp_index) && course.hcp_index.length === 18) metaRow("Hdcp", course.hcp_index, "");
      }
      gp.forEach(pl => {
        const tr = document.createElement("tr");
        const nameTd = document.createElement("td");
        nameTd.append(figureEl(pl, 16), pl.name);
        tr.append(nameTd);
        let tot = 0;
        for (let hn = 1; hn <= maxH; hn++) {
          const x = sc.find(s => s.player_id === pl.id && s.hole === hn);
          if (x) tot += x.strokes;
          tr.append(cell("td", x ? (x.strokes >= 11 ? "11+" : String(x.strokes)) + (pmulls.some(m => m.player_id === pl.id && m.hole === hn) ? "*" : "") : "-"));
        }
        tr.append(cell("td", tot ? String(tot) : "-", "tot"));
        table.append(tr);
      });
      wrap.append(table);
      cardsInfo.append(wrap);
    });
    hcInfo.innerHTML = "";
    if (round.handicap) {
      const allowAll = holeAllowances(round, players);
      const hh = document.createElement("h3");
      hh.textContent = "Handicap strokes";
      const ul = document.createElement("ul");
      ul.className = "player-list";
      players.filter(p => p.role !== "caddy").forEach(pl => {
        const li = document.createElement("li");
        const left = document.createElement("div");
        const nm = document.createElement("span");
        nm.append(figureEl(pl), pl.name + (pl.user_id === user.id ? " (you)" : ""));
        const d = document.createElement("span");
        d.className = "detail";
        d.textContent = strokeHolesText(allowAll[pl.id] || 0);
        left.append(nm, d);
        const v = document.createElement("span");
        v.className = "sub-score";
        v.textContent = pl.hcp != null ? "HCP " + pl.hcp : pl.usual_score ? "Shoots " + pl.usual_score : "";
        li.append(left, v);
        ul.append(li);
      });
      hcInfo.append(hh, ul);
    }
    if (isCaddy()) renderCaddyBoard();
    card.style.display = me ? "block" : "none";
    lateWrap.style.display = me ? "none" : "block";
    const prog = groupProgressHole();
    if (me && !cardReady) {
      cardReady = true;
      setHole(prog);
      maybeIntro(prog);
    } else if (me && lastProgress !== null && prog > lastProgress && hole === lastProgress) {
      const doneHole = lastProgress;
      setHole(prog);
      showHoleRecap(doneHole).then(() => maybeIntro(prog));
    } else if (me) drawCard();
    if (me && lastProgress !== null && players.filter(p => p.group_no === me.group_no && p.role !== "caddy")
      .every(p => scores.some(x => x.player_id === p.id && x.hole === holesIn(round) && x.strokes))) showHoleRecap(holesIn(round));
    lastProgress = prog;
  }

  const myScores = () => (me ? scores.filter(x => x.player_id === me.id) : []);

  function setHole(h) {
    hole = Math.min(groupProgressHole(), holesIn(round), Math.max(1, h));
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
    while (h < holesIn(round) && group.length && group.every(p => scores.some(x => x.player_id === p.id && x.hole === h && x.strokes))) h++;
    return h;
  }

  let introRunning = false;
  function maybeIntro(h) {
    if (!me || introRunning) return;
    const key = "parful-intro-" + round.id + "-" + h;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) {}
    introRunning = true;
    let ch = isParty() ? challengeFor(round.code, h, deckFor(round)) : null;
    let idx = ch ? deckFor(round).findIndex(c => c[0] === ch.text) : -1;
    let items = isParty() ? deckFor(round) : undefined;
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
    if (isStab()) message = "⭐ Par is worth 2 points";
    if (isBest()) message = "🤝 Carry your partner";
    if (isVegas()) message = "🎰 Lowest number wins the difference";
    if (isSixes()) {
      const st = sixesState(round, players, scores, me.group_no, false, course);
      if (st.valid) {
        const seg = sixesSegment(h, holesIn(round));
        message = (h > 1 && h === sixesSegHoles(seg, holesIn(round))[0] ? "🔄 New partners: " : "🤝 ") + sixesTeamsText(st.segs[seg].teams, st.byId);
      }
    }
    if (isNassau()) {
      const st = nassauState(round, players, scores, me.group_no);
      if (st.valid) {
        const pos = st.holes[h] ? st.holes[h].pos : h;
        const m = st.matches[pos <= 9 ? 0 : 1];
        message = "\u2694\uFE0F " + (pos === 10 ? "Back 9 starts. Overall: " + nassauStatusText(st.matches[2], st.names) : nassauLabel(m) + ": " + nassauStatusText(m, st.names));
      }
    }
    if (isWad()) {
      const st = wadState(players, wads, me.group_no);
      const per = Number(round.per_point || 0);
      const holder = players.find(pl => pl.id === st.holder);
      message = "💰 Pot: " + (per ? moneyFmt(st.units * per) : st.units + " Wads") + (holder ? ". " + holder.name + " holds it" : ". Up for grabs");
    }
    if (isSkins()) {
      const n = skinsState(round, players, scores).holes[h].pot;
      message = "💰 " + n + (n === 1 ? " skin" : " skins") + " on the line";
    }
    playHoleIntro({ hole: h, color, challenge: ch, idx, message, wolfGrab: isWolf(), coins: isSkins(), cartRun: isMatch() || isNassau(), bbb: isBbb(), carry: isBest() || isSixes(), slots: isVegas(), cashRain: isWad(), tornado: isStab(), items }).then(() => { introRunning = false; });
  }

  function drawCard() {
    const myGroup = me ? me.group_no : 1;
    const isLeader = round.host_id === user.id || (!!me && me.is_co_leader);
    const mine = {};
    myScores().forEach(x => (mine[x.hole] = x.strokes));
    tabBtns.hole.textContent = "Hole " + hole;
    $("hole-label").textContent = "Hole " + hole;
    const holeInfo = $("hole-info");
    if (holeInfo) {
      const bits = [];
      if (course && Array.isArray(course.pars)) bits.push("Par " + course.pars[hole - 1]);
      if (course && Array.isArray(course.yardages) && course.yardages[hole - 1]) bits.push(course.yardages[hole - 1] + " yds");
      if (course && Array.isArray(course.hcp_index) && course.hcp_index.length === 18) bits.push("Handicap " + course.hcp_index[hole - 1]);
      holeInfo.textContent = bits.join(" \u00B7 ");
      holeInfo.style.display = bits.length ? "" : "none";
    }
    $("hole-mine").textContent = mine[hole] ? "You: " + (mine[hole] >= 11 ? "11+" : mine[hole]) : "No score yet";
    if (round.handicap && me) {
      const got = strokesOn(holeAllowances(round, players)[me.id] || 0, hole);
      if (got > 0) $("hole-mine").textContent += ", you get " + (got === 1 ? "a stroke" : got + " strokes");
    }

    const strip = $("hole-strip");
    if (strip.childElementCount !== holesIn(round)) {
      strip.innerHTML = "";
      for (let n = 1; n <= holesIn(round); n++) {
        const b = document.createElement("button");
        b.className = "hole-chip";
        b.dataset.h = n;
        b.innerHTML = "<span>" + n + "</span><small></small>";
        b.onclick = () => setHole(n);
        strip.append(b);
      }
    }
    const progNow = groupProgressHole();
    const allowMe = round.handicap && me ? (holeAllowances(round, players)[me.id] || 0) : 0;
    strip.querySelectorAll(".hole-chip").forEach(b => {
      const n = +b.dataset.h;
      const locked = n > progNow;
      b.disabled = locked;
      b.classList.toggle("locked", locked);
      b.querySelector("small").textContent = locked ? "🔒" : (mine[n] >= 11 ? "11+" : (mine[n] || ""));
      b.classList.toggle("done", mine[n] != null);
      b.classList.toggle("active", n === hole);
      b.classList.toggle("stroke", allowMe > 0 && strokesOn(allowMe, n) > 0);
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
    renderMulligan(target);
    $("score-label").textContent = target.id === me.id ? "Your score" : target.name + "'s score";
    const missing = players.filter(p => p.group_no === myGroup && p.role !== "caddy")
      .filter(p => !scores.some(x => x.player_id === p.id && x.hole === hole && x.strokes));
    $("waiting-on").textContent = mine[hole] && missing.length ? "Waiting on " + missing.map(p => p.name).join(", ") : "";

    $("wolf-box").style.display = isWolf() ? "block" : "none";
    $("skins-box").style.display = isSkins() ? "block" : "none";
    $("stab-box").style.display = isStab() ? "block" : "none";
    if (isStab()) drawStab(target);
    const rb = $("recap-box");
    if (rb) {
      const gp = players.filter(p => p.group_no === myGroup && p.role !== "caddy");
      const doneHere = gp.length && gp.every(p => scores.some(x => x.player_id === p.id && x.hole === hole && x.strokes));
      const d = doneHere ? holeRecapData(hole, myGroup) : null;
      rb.innerHTML = "";
      rb.style.display = d ? "block" : "none";
      if (d) {
        const mk = (cls, text) => { const e = document.createElement("div"); e.className = cls; if (text != null) e.textContent = text; return e; };
        rb.append(mk("ch-kicker", "Hole " + hole + " result"), mk("recap-title", d.title));
        d.rows.forEach(r => {
          const row = mk("recap-row");
          const left = document.createElement("div");
          const name = document.createElement("span");
          name.append(figureEl(r.p, 16), d.nm(r.p));
          left.append(name);
          if (r.sub) left.append(mk("recap-sub", r.sub));
          const val = document.createElement("b");
          val.textContent = r.v;
          row.append(left, val);
          rb.append(row);
        });
        rb.append(mk("recap-note", d.note));
      }
    }
    $("match-box").style.display = isMatch() ? "block" : "none";
    $("caddy-box").style.display = isCaddy() ? "block" : "none";
    if (isCaddy()) drawCaddy(myGroup, isLeader);
    $("bbb-box").style.display = isBbb() ? "block" : "none";
    if (isBbb()) drawBbb(myGroup, isLeader);
    $("best-box").style.display = isBest() ? "block" : "none";
    if (isBest()) drawBest(myGroup);
    $("wad-box").style.display = isWad() ? "block" : "none";
    if (isWad()) drawWad(myGroup, isLeader);
    $("vegas-box").style.display = isVegas() ? "block" : "none";
    if (isVegas()) drawVegas(myGroup);
    $("sixes-box").style.display = isSixes() ? "block" : "none";
    if (isSixes()) drawSixes(myGroup);
    $("nassau-box").style.display = isNassau() ? "block" : "none";
    if (isNassau()) drawNassau(myGroup);
    const hideGrid = isCaddy() && !!me && me.role === "caddy" && !(keeperMode && canKeep());
    $("score-grid").style.display = hideGrid ? "none" : "";
    $("score-label").style.display = hideGrid ? "none" : "";
    if (isMatch()) drawMatch();
    if (isSkins()) drawSkins();
    if (isWolf()) drawWolf(myGroup, isLeader);
    $("ch-box").style.display = isParty() ? "block" : "none";
    if (!isParty()) return;
    const ch = challengeFor(round.code, hole, deckFor(round));
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
        b.append(figureEl(pl), pl.name);
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
      head.append(figureEl(cd, 14), cd.name + " caddying for ", figureEl(gf, 14), gf.name);
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
      name.append((i + 1) + ". ", figureEl(pl), pl.name + (pl.user_id === user.id ? " (you)" : ""));
      if (clubIds.has(pl.user_id)) name.append(clubBadge());
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
      return { pl, total, net: total - Math.floor(mine.length * (allow[pl.id] || 0) + 1e-9), thru: mine.length };
    }).sort((a, b) => (a.thru ? a.net / a.thru : Infinity) - (b.thru ? b.net / b.thru : Infinity))
      .forEach((r, i) => row(r.pl, r.thru ? r.total + " strokes" + (round.handicap ? ", net " + Math.round(r.net) : "") + " (thru " + r.thru + ")" : "-", i));
  }

  function drawWad(g, isLeader) {
    const st = wadState(players, wads, g);
    const per = Number(round.per_point || 0);
    const holder = players.find(pl => pl.id === st.holder);
    $("wad-pot").textContent = "💰 Pot: " + (per ? moneyFmt(st.units * per) : st.units + (st.units === 1 ? " Wad" : " Wads")) +
      (holder ? ". " + holder.name + " holds it." : ". Nobody's holding it yet.");
    $("wad-note").textContent = hole >= 16
      ? "Last three holes: only a Wad for net par or better takes the pot."
      : "First putt on the green from flagstick length or longer (or a chip-in) that drops. Birdie or better counts double.";
    const box = $("wad-log");
    box.innerHTML = "";
    const here = wads.filter(w => w.hole === hole && st.grp.some(pl => pl.id === w.player_id));
    here.forEach(w => {
      const pl = players.find(x => x.id === w.player_id);
      if (!pl) return;
      const line = document.createElement("div");
      line.className = "wad-line";
      const txt = document.createElement("span");
      txt.append(figureEl(pl), pl.name + " made one" + (w.birdie ? " for birdie (x2)" : ""));
      line.append(txt);
      if (isLeader || pl.user_id === user.id) {
        const un = document.createElement("button");
        un.className = "mini";
        un.textContent = "Undo";
        un.onclick = () => undoWad(w);
        line.append(un);
      }
      box.append(line);
    });
    const loggable = (isLeader ? st.grp : (me ? [me] : [])).filter(pl => !here.some(w => w.player_id === pl.id));
    if (loggable.length) {
      const row = document.createElement("div");
      row.className = "chip-row";
      loggable.forEach(pl => {
        const b = document.createElement("button");
        if (isLeader) b.append(figureEl(pl), pl.name + " made one");
        else b.textContent = "I made a Wad";
        b.onclick = () => logWad(pl);
        row.append(b);
      });
      box.append(row);
    }
  }

  async function logWad(pl) {
    const late = hole >= 16;
    const vals = await ask("Wad for " + pl.name + "?", [
      { label: "For birdie or better?", type: "toggle", hint: "Birdies count double" },
      ...(late ? [{ label: "For net par or better?", type: "toggle", hint: "On 16 to 18, only these can take the pot" }] : []),
    ], "Log it");
    if (!vals) return;
    const birdie = vals[0] === "on";
    const par = birdie || (late ? vals[1] === "on" : true);
    const { error } = await db.from("wads").insert({ round_id: round.id, player_id: pl.id, hole, birdie, par_or_better: par });
    if (error) { toast(error.code === "23505" ? pl.name + " already has a Wad on this hole." : error.message); return; }
    Sound.play("coin");
    const next = wads.concat([{ player_id: pl.id, hole, birdie, par_or_better: par, created_at: new Date().toISOString() }]);
    const st = wadState(players, next, pl.group_no);
    const per = Number(round.per_point || 0);
    const holder = players.find(x => x.id === st.holder);
    const body = "💰 " + pl.name + " drained a Wad on hole " + hole + (birdie ? " for birdie (double!)" : "") +
      ". Pot's at " + (per ? moneyFmt(st.units * per) : st.units + " Wads") + (holder ? ". " + holder.name + " holds it." : ".");
    db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto", body: body.slice(0, 280) }).then(() => {});
    refresh();
  }

  async function undoWad(w) {
    const { error } = await db.from("wads").delete().eq("id", w.id);
    if (error) { toast(error.message); return; }
    refresh();
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

  // "Holes 7–12: Alec & Sam vs Jo & Kim" and the live tally, for the segment the group is on
  function sixesSegText(st, seg) {
    const s = st.segs[seg], [lo, hi] = s.range;
    return "Holes " + lo + "\u2013" + hi + ": " + sixesTeamsText(s.teams, st.byId);
  }
  function sixesTallyText(st, seg) {
    const s = st.segs[seg], n = s.range[1] - s.range[0] + 1;
    const nm = t => t.map(id => st.byId[id].name).join(" & ");
    if (!s.played) return "Nobody's won a hole yet in this set.";
    const lead = s.won[1] > s.won[2] ? 1 : s.won[2] > s.won[1] ? 2 : 0;
    const tally = s.won[1] + "\u2013" + s.won[2];
    if (s.winner != null) return s.winner ? nm(s.teams[s.winner - 1]) + " won the set " + Math.max(s.won[1], s.won[2]) + "\u2013" + Math.min(s.won[1], s.won[2]) + ". +1 each." : "Set halved " + tally + ". \u00BD point each.";
    if (s.clinched) return nm(s.teams[s.clinched - 1]) + " have clinched it, " + Math.max(s.won[1], s.won[2]) + "\u2013" + Math.min(s.won[1], s.won[2]) + ".";
    return (lead ? nm(s.teams[lead - 1]) + " lead " + Math.max(s.won[1], s.won[2]) + "\u2013" + Math.min(s.won[1], s.won[2]) : "All square " + tally) + " thru " + s.played + " of " + n + ".";
  }
  function sixesNowText(g) {
    const st = sixesState(round, players, scores, g, false, course);
    if (!st.valid) return "Sixes needs exactly 4 golfers.";
    const seg = sixesSegment(Math.min(groupProgressHole(), holesIn(round)), holesIn(round));
    return sixesSegText(st, seg) + ". " + (st.nassau ? sixesBetsText(st, seg) : sixesTallyText(st, seg));
  }
  function drawSixes(g) {
    const st = sixesState(round, players, scores, g, false, course);
    if (!st.valid) {
      $("sixes-teams").textContent = "Sixes needs exactly 4 golfers.";
      $("sixes-result").textContent = "";
      return;
    }
    const seg = sixesSegment(hole, holesIn(round)), hi = st.holes[hole];
    const nm = t => t.map(id => st.byId[id].name).join(" & ");
    $("sixes-teams").textContent = sixesSegText(st, seg);
    const holeTxt = !hi || hi.winner == null ? "" : hi.winner
      ? nm(hi.teams[hi.winner - 1]) + " won this hole, " + (hi.secondBall ? "on the second ball. " : hi.best[hi.winner] + " to " + hi.best[3 - hi.winner] + ". ")
      : "Halved this hole at " + hi.best[1] + ". ";
    $("sixes-result").textContent = holeTxt + (st.nassau ? sixesBetsText(st, seg) + "." : sixesTallyText(st, seg)) + (round.handicap && !hi ? " Best net ball counts." : "");
  }

  // Nassau: one line per bet, "Front: Alec 2 UP", presses included
  function drawNassauLines(el, g) {
    const st = nassauState(round, players, scores, g);
    el.innerHTML = "";
    if (!st.valid) { el.textContent = nassauInvalidText(); return st; }
    nassauStatusLines(st).forEach(t => { const d = document.createElement("div"); d.textContent = t; el.append(d); });
    return st;
  }
  function nassauInvalidText() {
    return holesIn(round) !== 18 ? "Nassau needs 18 holes." : "Nassau needs 2 golfers, or 4 split into Team A and Team B.";
  }
  function nassauHoleText(st, hi) {
    if (!hi || hi.winner == null) return "";
    return hi.winner ? st.names[hi.winner - 1] + (st.sides[hi.winner - 1].length > 1 ? " win" : " wins") + " the hole, " + hi.best[hi.winner] + " to " + hi.best[3 - hi.winner] + "."
      : "Halved at " + hi.best[1] + ".";
  }
  function drawNassau(g) {
    const st = drawNassauLines($("nassau-status"), g);
    if (!st.valid) { $("nassau-teams").textContent = ""; $("nassau-result").textContent = ""; return; }
    $("nassau-teams").textContent = st.names[0] + " vs " + st.names[1];
    const hi = st.holes[hole];
    $("nassau-result").textContent = nassauHoleText(st, hi) || ("Lower " + (st.sides[0].length > 1 ? "best ball" : "score") + (round.handicap ? " (net)" : "") + " wins the hole. Same score halves it.");
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
          b.append(figureEl(p), p.name);
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
      players.forEach(pl => forRow.append(chip(pl.name, () => { betPoster = pl.id; renderBets(); }, pl.id === betPoster, pl)));
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
      top.append(figureEl(cr), cr.name + " bets " + amt);
      const body = document.createElement("div");
      body.className = "bet-body";
      body.textContent = "\u201C" + b.body + "\u201D";
      const status = document.createElement("div");
      status.className = "cp-note";
      const actions = document.createElement("div");
      actions.className = "chip-row";
      if (!b.taker_id) {
        status.textContent = "Open. Waiting for someone to take it.";
        if (isHost) players.filter(pl => pl.id !== cr.id).forEach(pl => actions.append(chip("Taken by " + pl.name, () => takeBet(b, pl), false, pl)));
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
      : info.result === "carry" ? (hole === holesIn(round) ? "Tie on " + hole + ". Those skins go unclaimed." : "Tie. " + (n === 1 ? "The skin carries" : "All " + n + " skins carry") + " to the next hole.")
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
    $("wolf-name").textContent = "🐺 " + info.wolf.name + (hole >= holesIn(round) - 1 && info.tee.length === 4 ? " (last place gets the Wolf)" : "");
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
      b.append(figureEl(p), p.name);
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
      b.append(figureEl(p), p.name + (sc ? ": " + (sc >= 11 ? "11+" : sc) : ""));
      b.classList.toggle("selected", p.id === target.id);
      b.onclick = () => { scoringFor = p.id; drawCard(); };
      row.append(b);
    });
  }

  function renderMulligan(target) {
    const box = $("mull-box");
    if (!box) return;
    box.innerHTML = "";
    const allowed = round.mulligans || 0;
    if (!allowed || !target || target.role === "caddy" || isCaddy()) { box.style.display = "none"; return; }
    box.style.display = "";
    const used = pmulls.filter(m => m.player_id === target.id);
    const here = used.find(m => m.hole === hole);
    const left = allowed - used.length;
    const mine = !!me && target.id === me.id;
    if (!here && left <= 0) {
      const p = document.createElement("span");
      p.className = "cp-note";
      p.textContent = (mine ? "You're" : target.name + " is") + " out of mulligans. Play it where it lies.";
      box.append(p);
      return;
    }
    const b = document.createElement("button");
    b.className = "mini" + (here ? " selected" : "");
    b.textContent = here
      ? "\u{1F501} Mulligan used on hole " + hole + ". Undo"
      : "\u{1F501} " + (mine ? "Use a mulligan" : "Use " + target.name + "'s mulligan") + " (" + left + " left)";
    b.onclick = () => setMulligan(target, !here);
    box.append(b);
  }

  async function setMulligan(target, on) {
    const h = hole;
    const { error } = on
      ? await db.from("player_mulligans").insert({ round_id: round.id, player_id: target.id, hole: h })
      : await db.from("player_mulligans").delete().eq("player_id", target.id).eq("hole", h);
    if (error) { toast(error.message); return; }
    if (on) {
      const left = (round.mulligans || 0) - pmulls.filter(m => m.player_id === target.id).length - 1;
      db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto",
        body: "\u{1F501} " + target.name + " took a mulligan on hole " + h + ". " + (left > 0 ? left + " left." : "That was the last one.") }).then(() => {});
    }
    refresh();
  }

  function drawStab(t) {
    const par = course && Array.isArray(course.pars) ? course.pars[hole - 1] : 4;
    $("stab-par").textContent = "Par " + par + (round.handicap ? " (net)" : "") + ". Double bogey 0, bogey 1, par 2, birdie 3, eagle 4.";
    const x = t && scores.find(s => s.player_id === t.id && s.hole === hole && s.strokes);
    const pts = x ? stablefordPoints(x, course, holeAllowances(round, players)) : null;
    $("stab-result").textContent = x ? (t.id === me.id ? "You" : t.name) + " scored " + pts + (pts === 1 ? " point" : " points") + " here." : "";
  }

  function renderCoursePanel() {
    const p = panels.course;
    p.innerHTML = "";
    const isHost = round.host_id === user.id;
    const h = document.createElement("h3");
    h.textContent = course ? course.name + (course.tee_name ? " (" + course.tee_name + " tees)" : "") : "No course picked";
    if (round.mini) h.append(" ", MINI_TAG());
    p.append(h);
    if (course && Array.isArray(course.pars)) {
      const wrap = document.createElement("div");
      wrap.className = "sc-wrap";
      const t = document.createElement("table");
      t.className = "sc-table";
      const row = (label, vals, cls) => {
        const tr = document.createElement("tr");
        if (cls) tr.className = cls;
        [label, ...vals].forEach(v => { const td = document.createElement("td"); td.textContent = v == null ? "-" : v; tr.append(td); });
        t.append(tr);
      };
      row("Hole", course.pars.map((_, i) => i + 1), "sc-meta");
      row("Par", course.pars);
      if (Array.isArray(course.hcp_index) && course.hcp_index.length === 18) row("Hdcp", course.hcp_index, "sc-meta");
      wrap.append(t);
      p.append(wrap);
    }
    const note = document.createElement("p");
    note.className = "waiting";
    note.textContent = isHost ? "Spot a wrong par? Fix it here. Scores stay put." : "Spot a wrong par? Tell the party leader. They can fix it here.";
    p.append(note);
    if (isHost) {
      const b = document.createElement("button");
      b.textContent = course ? "Fix the pars" : "Add the pars";
      b.style.cssText = "width:100%;margin-top:8px";
      b.onclick = fixPars;
      p.append(b);
    }
  }

  async function fixPars() {
    const old = course;
    const m = round.mini
      ? await parsModal({ mini: true, name: old ? old.name : "", pars: old ? old.pars : null, lockHoles: holesIn(round) })
      : await parsModal(old ? { name: old.name, location: old.location, tee_name: old.tee_name, pars: old.pars, hcp_index: old.hcp_index } : "");
    if (!m) return;
    const keep = old && !round.mini ? { rating: old.rating, slope: old.slope, yardage: old.yardage, tee_gender: old.tee_gender,
      rating_source: old.rating_source, external_id: old.external_id, source: old.source } : {};
    let data;
    if (guestCard()) {
      data = await keepCardOnRound(m);
      if (!data) return;
    } else {
      const ins = await db.from("courses").insert({ ...m, ...keep }).select().single();
      if (ins.error) { toast(ins.error.message); return; }
      data = ins.data;
      const up = await db.from("rounds").update({ course_id: data.id }).eq("id", round.id);
      if (up.error) { toast(up.error.message); return; }
      round.course_id = data.id;
      course = data;
    }
    let body;
    if (old) {
      const diffs = data.pars.map((pp, i) => (pp !== old.pars[i] ? "hole " + (i + 1) + " is now a par " + pp : null)).filter(Boolean);
      const hcpChanged = JSON.stringify(old.hcp_index || null) !== JSON.stringify(data.hcp_index || null);
      body = diffs.length ? "\u{1F4DD} Pars fixed: " + diffs.join(", ") + "." : hcpChanged ? "\u{1F4DD} Hole handicaps updated." : null;
    } else body = "\u{1F4DD} Course added: " + data.name + ", par " + data.pars.reduce((a, b) => a + b, 0) + ".";
    if (body && me) db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto", body: body.slice(0, 280) }).then(() => {});
    await refresh();
    renderCoursePanel();
  }

  function holeRecapData(h, g) {
    const gp = players.filter(p => p.group_no === g && p.role !== "caddy");
    const allow = holeAllowances(round, players);
    const nm = p => (!p ? "?" : p.user_id === user.id ? "You" : p.name);
    const byId = id => players.find(p => p.id === id);
    const net = x => netOf(x, allow);
    const rows = gp.map(p => ({ p, x: scores.find(s => s.player_id === p.id && s.hole === h && s.strokes) })).filter(r => r.x);
    if (!rows.length) return null;
    const sTxt = x => (x.strokes >= 11 ? "11+" : String(x.strokes)) + (round.handicap && net(x) !== x.strokes ? " (net " + net(x) + ")" : "");
    rows.forEach(r => { r.v = sTxt(r.x); r.sub = ""; });
    const lows = () => { const m = Math.min(...rows.map(r => net(r.x))); return rows.filter(r => net(r.x) === m); };
    const winLine = arr => arr.length === 1
      ? nm(arr[0].p) + (arr[0].p.user_id === user.id ? " win" : " wins") + " the hole"
      : "Tie between " + arr.map(r => nm(r.p)).join(" and ");
    const topPts = () => { const m = Math.max(...rows.map(r => r.pts)); return winLine(rows.filter(r => r.pts === m)); };
    let title = "", note = "";
    if (isParty()) {
      const played = scores.filter(s => s.hole === h && s.strokes);
      rows.forEach(r => {
        const beat = played.filter(o => net(o) > net(r.x)).length;
        const ch = results.filter(z => z.hole === h && z.winner_id === r.p.id && !z.award).reduce((a, z) => a + z.points, 0);
        r.pts = 1 + beat + ch;
        r.v = (r.pts > 0 ? "+" : "") + r.pts;
        r.sub = sTxt(r.x) + " strokes, beat " + beat + (ch ? ", challenge " + (ch > 0 ? "+" : "") + ch : "");
      });
      title = topPts();
      note = "1 point for finishing, +1 for each player you beat, plus or minus the challenge card.";
    } else if (isStab()) {
      rows.forEach(r => { r.pts = stablefordPoints(r.x, course, allow); r.v = "+" + r.pts; r.sub = sTxt(r.x) + " strokes"; });
      title = topPts();
      note = "Bogey 1, par 2, birdie 3, eagle 4. Double bogey or worse scores 0.";
    } else if (isSkins()) {
      const info = skinsState(round, players, scores).holes[h];
      const n = info.pot, word = n === 1 ? " skin" : " skins";
      title = info.result === "won" ? nm(info.winner) + " took " + n + word
        : h === holesIn(round) ? "Tie on " + h + ". Those skins go unclaimed." : "Tie. " + n + word + " carry to hole " + (h + 1);
      note = "Lowest score alone takes the skins. Any tie carries them over.";
    } else if (isMatch()) {
      const ms = matchState(round, players, scores, g);
      title = ms.valid && ms.holes[h] && ms.holes[h].result ? ms.holes[h].result : winLine(lows());
      note = "Lowest score wins the hole. Same score halves it.";
    } else if (isWolf()) {
      const st = wolfState(round, players, scores, picks, g);
      const r = st.valid && st.holes[h] ? st.holes[h].result : null;
      title = !r ? winLine(lows()) : r.kind === "push" ? "Push. No points."
        : r.kind === "nopick" ? "No pick was made, so it pushed."
        : r.ids.map(id => nm(byId(id))).join(" + ") + " won it, +" + r.pts + (r.ids.length > 1 ? " each" : "");
      note = "The Wolf's side needs the best score. Going alone pays more.";
    } else if (isBbb()) {
      title = ["bingo", "bango", "bongo"].map(k => {
        const z = results.find(q => q.hole === h && q.group_no === g && q.award === k);
        return k[0].toUpperCase() + k.slice(1) + ": " + (z ? nm(byId(z.winner_id)) : "nobody");
      }).join(" \u00B7 ");
      note = "First on the green, closest to the pin, first in the cup. 1 point each.";
    } else if (isBest()) {
      const st = bestBallState(round, players, scores, g);
      const hi = st.valid ? st.holes[h] : null;
      title = !hi ? winLine(lows()) : hi.winner ? TEAM_NAMES[hi.winner] + " takes it, " + hi.best[hi.winner] + " to " + hi.best[3 - hi.winner]
        : "Tie at " + hi.best[1] + ". No points.";
      note = "Each team's lowest score counts. Better ball wins the point.";
    } else if (isVegas()) {
      const st = vegasState(round, players, scores, g);
      const hi = st.valid ? st.holes[h] : null;
      title = !hi ? winLine(lows()) : hi.winner ? TEAM_NAMES[hi.winner] + " wins by " + hi.diff + " (" + hi.num[hi.winner] + " vs " + hi.num[3 - hi.winner] + ")"
        : "Both teams made " + hi.num[1] + ". Push.";
      note = "Each team's two scores make one number, low score first. Lowest number wins the difference.";
    } else if (isSixes()) {
      const st = sixesState(round, players, scores, g, false, course);
      const hi = st.valid ? st.holes[h] : null;
      if (!hi || hi.winner == null) title = winLine(lows());
      else {
        const tn = t => t.map(id => nm(byId(id))).join(" & ");
        title = hi.winner ? tn(hi.teams[hi.winner - 1]) + " win the hole, " + (hi.secondBall ? "on the second ball" : hi.best[hi.winner] + " to " + hi.best[3 - hi.winner])
          : "Halved at " + hi.best[1];
        rows.forEach(r => { const t = hi.teams.findIndex(x => x.includes(r.p.id)); r.sub = "With " + nm(byId(hi.teams[t].find(id => id !== r.p.id))); });
      }
      note = !st.valid || !hi ? "Each team's best ball wins the hole. Most holes in the set wins it."
        : st.nassau ? hi.birdies.map(t => "Birdie bonus: " + sixesNames(st.segs[hi.seg], st.byId)[t - 1] + " +1 each. ").join("") + sixesBetsText(st, hi.seg)
        : sixesTallyText(st, hi.seg);
    } else if (isNassau()) {
      const st = nassauState(round, players, scores, g);
      const hi = st.valid ? st.holes[h] : null;
      title = hi && hi.winner != null ? nassauHoleText(st, hi).replace(/\.$/, "") : winLine(lows());
      if (hi && st.sides[0].length > 1) rows.forEach(r => { const t = st.sides.findIndex(x => x.includes(r.p.id)); r.sub = "With " + nm(byId(st.sides[t].find(id => id !== r.p.id))); });
      // The nine being played, the Overall, and any press that covers this hole
      note = st.valid ? st.matches.filter(m => m.key === "overall" || (hi && (m.key === "press" ? hi.pos >= m.range[0] && hi.pos <= m.range[1] : m.nine === (hi.pos <= 9 ? 0 : 1))))
        .map(m => nassauLabel(m) + ": " + nassauStatusText(m, st.names)).join(" \u00B7 ") : "Lower score wins the hole. Same score halves it.";
    } else if (isWad()) {
      const made = wads.filter(w => w.hole === h && gp.some(p => p.id === w.player_id));
      title = made.length ? made.map(w => nm(byId(w.player_id))).join(" and ") + " made a Wad" : "No Wads this hole";
      note = "Drain your first putt from flagstick length or longer and the pot grows.";
    } else if (isCaddy()) {
      const calls = preds.filter(z => z.hole === h && z.outcome != null && gp.some(p => p.id === z.golfer_id));
      title = calls.length ? calls.map(z => nm(byId(z.caddy_id)) + " +" + (z.points || 0)).join(" \u00B7 ") : "No caddy calls settled";
      note = "Caddies get 3 for calling it and 1 for close.";
    } else {
      title = winLine(lows());
      note = "Lowest score takes the hole. In stroke play every shot counts toward your total.";
    }
    const par = course && Array.isArray(course.pars) ? course.pars[h - 1] : null;
    if (par) note = "Par " + par + ". " + note;
    return { title, note, rows, nm };
  }

  function showHoleRecap(h) {
    return new Promise(resolve => {
      if (!me) return resolve();
      const key = "parcade-recap-" + round.id + "-" + h;
      try { if (localStorage.getItem(key)) return resolve(); localStorage.setItem(key, "1"); } catch (e) {}
      const d = holeRecapData(h, me.group_no);
      if (!d) return resolve();
      const mk = (cls, text) => { const e = document.createElement("div"); e.className = cls; if (text != null) e.textContent = text; return e; };
      const ov = mk("recap");
      ov.setAttribute("role", "status");
      const card = mk("recap-card");
      card.append(mk("recap-kicker", "Hole " + h + " results"), mk("recap-title", d.title));
      const list = mk("recap-rows");
      d.rows.forEach(r => {
        const row = mk("recap-row");
        const left = document.createElement("div");
        const name = document.createElement("span");
        name.append(figureEl(r.p, 16), d.nm(r.p));
        left.append(name);
        if (r.sub) left.append(mk("recap-sub", r.sub));
        const val = document.createElement("b");
        val.textContent = r.v;
        row.append(left, val);
        list.append(row);
      });
      const go = document.createElement("button");
      go.className = "recap-btn";
      go.textContent = "Continue";
      card.append(list, mk("recap-note", d.note), go);
      ov.append(card);
      document.body.append(ov);
      Sound.play("pop");
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(() => { ov.remove(); (isSixes() ? showSixesPress(h).then(() => showSixesSwitch(h)) : isNassau() ? showNassauPress(h).then(() => showNassauTurn(h)) : Promise.resolve()).then(resolve); });
      };
      go.onclick = close;
      setTimeout(() => go.focus({ preventScroll: true }), 50);
    });
  }

  // Sixes: after holes 6 and 12 (3 and 6 on a 9-hole card), how the set ended and who's partners now
  function showSixesSwitch(h) {
    return new Promise(resolve => {
      const n = holesIn(round) / 3;
      if (!me || (h !== n && h !== 2 * n)) return resolve();
      const st = sixesState(round, players, scores, me.group_no, false, course);
      if (!st.valid) return resolve();
      const done = st.segs[h / n - 1], next = st.segs[h / n];
      const mk = (cls, text) => { const e = document.createElement("div"); e.className = cls; if (text != null) e.textContent = text; return e; };
      const ov = mk("recap");
      ov.setAttribute("role", "status");
      const card = mk("recap-card sixes-switch");
      const crab = mk("sixes-crabby");
      crab.append(crabbyEl(44), mk("sixes-quip", CRABBY_SIXES.switch[(h / n - 1 + round.code.length) % CRABBY_SIXES.switch.length]));
      card.append(mk("recap-kicker", "Partners switch!"), mk("recap-title", "Holes " + next.range[0] + "\u2013" + next.range[1]), crab);
      const list = mk("recap-rows");
      next.teams.forEach((t, i) => {
        const row = mk("recap-row");
        const name = document.createElement("span");
        t.forEach((id, k) => { if (k) name.append(" & "); name.append(figureEl(st.byId[id], 16), st.byId[id].user_id === user.id ? "You" : st.byId[id].name); });
        row.append(name, mk("recap-sub", i ? "Team 2" : "Team 1"));
        list.append(row);
      });
      const go = document.createElement("button");
      go.className = "recap-btn";
      go.textContent = "Let's go";
      card.append(list);
      // With Nassau bets, how each of the set's bets ended
      if (st.nassau) {
        const bets = mk("recap-rows");
        sixesBetRows(st, done.seg).concat(sixesBirdieRows(st, done.seg)).forEach(([a, b]) => {
          const row = mk("recap-row");
          row.append(mk("", a), mk("recap-sub", b));
          bets.append(row);
        });
        card.append(mk("recap-kicker", "Last set's bets"), bets);
      } else card.append(mk("recap-note", "Last set: " + sixesTallyText(st, done.seg)));
      card.append(go);
      ov.append(card);
      document.body.append(ov);
      Sound.play("pop");
      let closed = false;
      go.onclick = () => {
        if (closed) return;
        closed = true;
        ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(() => { ov.remove(); resolve(); });
      };
      setTimeout(() => go.focus({ preventScroll: true }), 50);
    });
  }

  // Nassau: a small card with Crabby. kicker, title, a Crabby line, and rows of [left, right].
  function nassauCard(kicker, title, quip, rows, note, btn) {
    return new Promise(resolve => {
      const mk = (cls, text) => { const e = document.createElement("div"); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
      const ov = mk("recap");
      ov.setAttribute("role", "status");
      const card = mk("recap-card sixes-switch");
      const crab = mk("sixes-crabby");
      crab.append(crabbyEl(44), mk("sixes-quip", quip));
      card.append(mk("recap-kicker", kicker), mk("recap-title", title), crab);
      const list = mk("recap-rows");
      rows.forEach(([a, b]) => { const row = mk("recap-row"); row.append(mk(null, a), mk("recap-sub", b)); list.append(row); });
      const go = document.createElement("button");
      go.className = "recap-btn";
      go.textContent = btn;
      card.append(list);
      if (note) card.append(mk("recap-note", note));
      card.append(go);
      ov.append(card);
      document.body.append(ov);
      Sound.play("pop");
      let closed = false;
      go.onclick = () => {
        if (closed) return;
        closed = true;
        ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(() => { ov.remove(); resolve(); });
      };
      setTimeout(() => go.focus({ preventScroll: true }), 50);
    });
  }
  const crabbyPick = (list, n) => list[(n + round.code.length) % list.length];
  // Presses that started off hole h
  function showNassauPress(h) {
    if (!me) return Promise.resolve();
    const st = nassauState(round, players, scores, me.group_no);
    const hi = st.valid ? st.holes[h] : null;
    if (!hi || !hi.presses.length) return Promise.resolve();
    const ps = hi.presses.map(i => st.matches[i]);
    const title = ps.every(m => m.by === ps[0].by) ? st.names[ps[0].by - 1] + (st.sides[0].length > 1 ? " press" : " presses") : "Both sides press";
    return nassauCard("Press!", title, crabbyPick(CRABBY_NASSAU.press, h),
      ps.map(m => [nassauLabel(m), "On the " + nassauLabel(st.matches[m.parent]).toLowerCase() + ": " + nassauStatusText(st.matches[m.parent], st.names)]),
      "Each press is its own 1-point bet. It doesn't change the front, back or overall.", "Bring it");
  }
  // Sixes with Nassau bets: presses that started off hole h
  function showSixesPress(h) {
    if (!me) return Promise.resolve();
    const st = sixesState(round, players, scores, me.group_no, false, course);
    const hi = st.valid && st.nassau ? st.holes[h] : null;
    if (!hi || !hi.presses.length) return Promise.resolve();
    const s = st.segs[hi.seg], names = sixesNames(s, st.byId), ps = hi.presses.map(i => s.bets[i]);
    const title = ps.every(m => m.by === ps[0].by) ? names[ps[0].by - 1] + " press" : "Both teams press";
    return nassauCard("Press!", title, crabbyPick(CRABBY_SIXES.press, h),
      ps.map(m => [nassauLabel(m), "On the " + nassauLabel(s.bets[m.parent]).toLowerCase() + ": " + nassauStatusText(s.bets[m.parent], names)]),
      "Each press is its own 1-point bet. It doesn't change the front, back or overall.", "Bring it");
  }
  // At the turn: how the Front 9 went
  function showNassauTurn(h) {
    if (!me) return Promise.resolve();
    const st = nassauState(round, players, scores, me.group_no);
    if (!st.valid || !st.holes[h] || st.holes[h].pos !== 9) return Promise.resolve();
    const front = st.matches[0];
    const presses = st.matches.filter(m => m.key === "press" && m.nine === 0);
    const title = front.winner ? st.names[front.winner - 1] + (st.sides[0].length > 1 ? " take" : " takes") + " the Front 9" : front.winner === 0 ? "Front 9 halved" : "Front 9";
    return nassauCard("The turn", title, crabbyPick(CRABBY_NASSAU.turn, 0),
      [["Front", nassauStatusText(front, st.names)], ...presses.map(m => [nassauLabel(m), nassauStatusText(m, st.names)]), ["Overall", nassauStatusText(st.matches[2], st.names)]],
      "Back 9 is a fresh bet. Overall keeps going.", "Make the turn");
  }

  async function saveScore(n) {
    const h = hole;
    const target = keeperTarget(me ? me.group_no : 1);
    const prev = (scores.find(x => x.player_id === target.id && x.hole === h) || {}).strokes;
    const { error } = await db.from("scores").upsert(
      { round_id: round.id, player_id: target.id, hole: h, strokes: n },
      { onConflict: "player_id,hole" });
    if (error) { toast("Error: " + error.message); return; }
    const parH = (course && course.pars ? course.pars[h - 1] : null);
    Sound.play(n === 1 ? "ace" : parH ? (n - parH <= -1 ? "fanfare" : n - parH >= 3 ? "sad" : "pop") : n >= 8 ? "sad" : "pop");
    if (n !== prev) {
      const line = scoreLine(target.name, n, h, (course && course.pars ? course.pars[h - 1] : null));
      if (line) db.from("messages").insert({ round_id: round.id, player_id: me.id, kind: "auto", body: line }).then(() => {});
    }
    if (keeperMode) scoringFor = null;
    refresh();
  }

  async function awardChallenge(playerId, multi) {
    const ch = challengeFor(round.code, hole, deckFor(round));
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
    const choice = await pickFrom("Which one is you?", players.map(pl => ({ label: pl.name, value: pl, color: pl })));
    if (!choice) return;
    const { error } = await db.rpc("claim_player", { p_player_id: choice.id });
    if (error) {
      if (/account/i.test(error.message)) {
        const go = await ask("Sign in to get your spot back", [], "Sign in", "That spot belongs to an account. Sign in with it and you're right back in the round.");
        if (go && (await signIn())) location.reload();
        return;
      }
      toast(error.message);
      return;
    }
    cardReady = false;
    refresh();
  }

  async function doJoin() {
    const joinName = await accountName();
    const fit = await myOutfit();
    const vals = await ask("Join " + round.name, [
      { label: "Your name", placeholder: "What your crew calls you", max: 20, value: joinName },
      { label: "Shirt color for this round", type: "colors", taken: players.map(p => p.color), selected: fit.shirtColor, outfit: fit }
    ], "I'm in");
    if (!vals) return;
    let hc = (await myHandicap()) || { usual: null, hcp: null };
    if (round.handicap && !hc.usual) { hc = await askHandicap(); if (!hc) return; saveMyHandicap(hc); }
    if (!vals) return;
    await ensureUser();
    const pc = vals[1] === "-" ? null : vals[1];
    const { error } = await insertPlayer({ round_id: round.id, name: vals[0], color: pc, usual_score: hc.usual, hcp: hc.hcp,
      outfit: { ...fit, shirtColor: pc || fit.shirtColor } });
    if (error && error.code === "23505") { toast("Someone just grabbed that color. Pick another."); refresh(); return; }
    if (error) { toast("Error: " + error.message); return; }
    refresh();
  }
  join.onclick = doJoin;
  lateJoin.onclick = rejoin;

  await refresh();
  endRoundLoading();
  loadMessages();
  const live = { schema: "public" };
  db.channel("round-" + round.id)
    .on("postgres_changes", { ...live, event: "*", table: "players", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "scores", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "challenge_results", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "UPDATE", table: "rounds", filter: "id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "wads", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "bets", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "caddy_pairs", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "predictions", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "mulligans", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "wolf_picks", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "*", table: "player_mulligans", filter: "round_id=eq." + round.id }, refresh)
    .on("postgres_changes", { ...live, event: "INSERT", table: "messages", filter: "round_id=eq." + round.id }, (payload) => onMessage(payload.new))
    .subscribe();
  setInterval(async () => {
    if (document.hidden || gone) return;
    const { data } = await db.from("messages").select("*").eq("round_id", round.id).order("created_at").limit(300);
    (data || []).forEach(m => onMessage(m));
  }, 8000);
  let pollTick = 0;
  setInterval(() => {
    pollTick++;
    if (!document.hidden && (round.status === "lobby" || pollTick % 5 === 0)) refresh();
  }, 4000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}

const roundCode = new URLSearchParams(location.search).get("r");
if (!roundCode) {
  const sb = soundButton();
  sb.classList.add("sound-home", "home-only");
  document.body.append(sb);
  const tb = document.createElement("span");
  tb.className = "sound-ctl sound-home theme-home home-only";
  tb.append(themeButton());
  document.body.append(tb);
  let hintSeen = false;
  try { hintSeen = sessionStorage.getItem("parcade-sound-hint") === "1"; } catch (e) {}
  if (Sound.muted && !hintSeen) {
    const hint = document.createElement("div");
    hint.className = "sound-hint home-only";
    hint.setAttribute("role", "status");
    hint.textContent = "🔊 Tap the speaker for music and sound.";
    const x = document.createElement("button");
    x.className = "sound-hint-x";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "×";
    const hide = () => {
      hint.remove();
      sb.classList.remove("pulse");
      try { sessionStorage.setItem("parcade-sound-hint", "1"); } catch (e) {}
    };
    x.onclick = hide;
    sb.addEventListener("click", hide);
    hint.append(x);
    document.body.append(hint);
    sb.classList.add("pulse");
  }
  Sound.music(true);
}
if (roundCode) loadRound(roundCode);
else Promise.resolve()
  .then(() => { $("status").textContent = ""; return renderAccount(); })
  .then(() => {
    // /club sends guests here to make an account first
    if (new URLSearchParams(location.search).get("create") !== "1") return;
    history.replaceState(null, "", "/");
    if (!window.__signedIn) createAccount();
  })
  .catch(err => { $("status").textContent = "Error: " + err.message; });

$("join-code").onclick = async () => {
  const vals = await ask("Join a round", [
    { label: "Round code", placeholder: "AB12CD", max: 6, upper: true }
  ], "Let's go");
  if (vals) openRound(vals[0].toUpperCase());
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
  gateHomeButtons(!!(u && !u.is_anonymous));
  await loadClub();
  el.innerHTML = "";
  if (u && !u.is_anonymous) {
    const who = document.createElement("span");
    const nm = u.user_metadata && u.user_metadata.first_name;
    who.textContent = "Signed in as " + (nm || u.email);
    if (tier() === "club") who.append(clubBadge());
    el.append(who);
    if (!nm) el.append(linkBtn("Add your name", async () => { if (await askFirstName()) renderAccount(); }));
    el.append(linkBtn("Sign out", signOut));
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
  if (m.includes("not confirmed")) return "Confirm your email first. Check your inbox for the link.";
  if (m.includes("rate limit")) return "Too many emails sent. Wait a minute and try again.";
  if (m.includes("invalid login")) return "That email and password don't match. Try again.";
  if (m.includes("already")) return "That email already has an account. Sign in instead.";
  if (m.includes("password")) return "Password needs at least 6 characters.";
  if (m.includes("email")) return "That doesn't look like a valid email address.";
  return (err && err.message) || "Something went wrong. Try again.";
}

async function createAccount() {
  const vals = await ask("Create your account", [
    { label: "First name", placeholder: "What should we call you?", max: 30 },
    { label: "Email", type: "email", placeholder: "you@example.com", max: 120 },
    { type: "check", html: 'I\'m 13 or older and agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms</a> and <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.' },
  ], "Send confirmation", "We'll email you a link. Tap it, then pick a password.", async ([first, email, agree]) => {
    if (agree !== "yes") return "Please check the box to agree to the Terms and Privacy Policy.";
    try {
      await ensureUser();
      await loadShop();
      const guestFit = guestOutfit() && ownedOutfit(normalizeOutfit(guestOutfit()));
      const { error } = await db.auth.updateUser(
        { email, data: { first_name: first, needs_password: true, terms_accepted_at: new Date().toISOString(), terms_version: "2026-10-03",
          ...(guestFit ? { outfit: guestFit } : {}) } },
        { emailRedirectTo: location.origin + location.pathname + location.search });
      if (error) throw error;
      return null;
    } catch (e) { return friendlyAuthError(e); }
  });
  if (vals) toast("Check your email and tap the link to confirm your account.", true);
  return false;
}

async function signIn() {
  const vals = await ask("Sign in", authFields, "Sign in", null, async ([email, password]) => {
    const { error } = await db.auth.signInWithPassword({ email, password });
    return error ? friendlyAuthError(error) : null;
  }, null, "Forgot password?");
  if (vals === "ALT") { await forgotPassword(); return false; }
  if (!vals) return false;
  userPromise = null;
  if (!(await accountName())) await askFirstName();
  renderAccount();
  return true;
}

async function signOut() {
  await db.auth.signOut();
  userPromise = null;
  renderAccount();
}

function toast(msg, ok) {
  const t = document.createElement("div");
  t.className = "toast" + (ok ? " ok" : "");
  t.setAttribute("role", "alert");
  t.textContent = String(msg).replace(/^Error: /, "");
  document.body.append(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3600);
}

// Someone deleted the round or season we're looking at: swap the page for a note and a Home button
function showDeleted(box, what) {
  document.querySelectorAll(".modal").forEach(m => m.remove());
  document.querySelectorAll(".top-actions").forEach(b => b.remove());
  document.body.classList.remove("has-rail", "has-copy");
  document.body.style.paddingTop = "";
  document.querySelector("h1 + p").textContent = "";
  box.innerHTML = "";
  const home = document.createElement("button");
  home.textContent = "Home";
  home.style.width = "100%";
  home.onclick = () => { location.href = "/"; };
  const p = document.createElement("p");
  p.className = "gone-note";
  p.textContent = "This " + what + " was deleted.";
  box.append(p, home);
}

function openRound(code) {
  document.querySelectorAll(".season-box").forEach(b => b.remove());
  history.pushState({}, "", "/?r=" + code);
  loadRound(code);
}
window.addEventListener("popstate", (e) => {
  if (e.state && e.state.step && window.__lobbyStep && document.querySelector(".top-actions")) return window.__lobbyStep(e.state.step, true);
  const sp = new URLSearchParams(location.search);
  if (sp.get("r") || document.querySelector(".top-actions")) return location.reload();
  if (sp.has("seasons") || sp.get("s") || sp.has("tournaments") || sp.get("t")) return seasonsRoute();
  showHomeView();
});

async function accountName() {
  const { data: { session } } = await db.auth.getSession();
  const u = session && session.user;
  return (u && !u.is_anonymous && u.user_metadata && u.user_metadata.first_name) || "";
}

async function askFirstName() {
  const n = await ask("What's your first name?", [{ label: "First name", placeholder: "So we can fill it in for you", max: 30 }], "Save");
  if (!n) return false;
  const { error } = await db.auth.updateUser({ data: { first_name: n[0] } });
  if (error) { toast(error.message); return false; }
  return true;
}

async function showRecentRounds() {
  await ensureUser();
  const { data: { session } } = await db.auth.getSession();
  const uid = session && session.user && session.user.id;
  if (!uid) return;
  const { data: mine } = await db.from("players").select("round_id").eq("user_id", uid);
  const ids = [...new Set((mine || []).map(x => x.round_id))];
  if (!ids.length) { toast("No rounds yet. Go play one."); return; }
  const { data: rounds } = await db.from("rounds").select("id, name, code, status, created_at, mini").in("id", ids).order("created_at", { ascending: false }).limit(5);
  const label = r => r.name + " (" + (r.status === "finished" ? "finished" : r.status === "playing" ? "in progress" : "not started") +
    ", " + new Date(r.created_at).toLocaleDateString() + ")";
  const choice = await pickFrom("Your 5 most recent rounds", (rounds || []).map(r => ({ label: label(r), value: r, tag: r.mini ? "Mini-golf" : null })));
  if (choice) openRound(choice.code);
}
const recentBtn = $("recent-btn");
if (recentBtn) recentBtn.onclick = showRecentRounds;

async function forgotPassword() {
  const v = await ask("Reset your password", [{ label: "Email", type: "email", placeholder: "you@example.com", max: 120 }],
    "Send reset link", "We'll email you a link to set a new password.", async ([email]) => {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + location.search });
      return error ? friendlyAuthError(error) : null;
    });
  if (v) toast("Check your email for a reset link.", true);
}

let recoveryShown = false;
async function setNewPassword() {
  if (recoveryShown) return;
  recoveryShown = true;
  const v = await ask("Set a new password", [{ label: "New password", type: "password", placeholder: "At least 6 characters", max: 72 }],
    "Save password", null, async ([pw]) => {
      if (pw.length < 6) return "Password needs at least 6 characters.";
      const { error } = await db.auth.updateUser({ password: pw });
      return error ? friendlyAuthError(error) : null;
    });
  history.replaceState({}, "", location.pathname + location.search);
  if (v) {
    toast("Password updated. You're signed in.", true);
    userPromise = null;
    renderAccount();
  }
}
const cameFromReset = location.hash.includes("type=recovery");
db.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setTimeout(setNewPassword, 300); });
if (cameFromReset) setTimeout(setNewPassword, 1200);

let finishing = false;
async function maybeFinishAccount() {
  if (finishing) return;
  const { data: { session } } = await db.auth.getSession();
  const u = session && session.user;
  if (!u || u.is_anonymous || !u.user_metadata || !u.user_metadata.needs_password) return;
  finishing = true;
  const v = await ask("Almost done. Pick a password", [{ label: "Password", type: "password", placeholder: "At least 6 characters", max: 72 }],
    "Save password", "Your email's confirmed. This is what you'll use to sign in.", async ([pw]) => {
      if (pw.length < 6) return "Password needs at least 6 characters.";
      const { error } = await db.auth.updateUser({ password: pw, data: { needs_password: false } });
      return error ? friendlyAuthError(error) : null;
    });
  finishing = false;
  if (v) {
    toast("You're all set. Welcome to Parcade.", true);
    userPromise = null;
    renderAccount();
  }
}
setTimeout(maybeFinishAccount, 1500);
db.auth.onAuthStateChange((event) => { if (event === "USER_UPDATED" || event === "SIGNED_IN") setTimeout(maybeFinishAccount, 300); });

function parsModal(prefill) {
  return new Promise(resolve => {
    const pre = prefill && typeof prefill === "object" ? prefill : { name: prefill || "" };
    // Mini-golf: 9 or 18 holes, pars 1 to 9 (default 2), no location, tees or hole handicaps
    const mini = !!pre.mini;
    const [lo, hi, dflt] = mini ? [1, 9, 2] : [3, 6, 4];
    const fits = n => pre.pars && pre.pars.length === n;
    let pars = fits(18) || (mini && fits(9)) ? pre.pars.slice()
      : Array(mini && pre.lockHoles === 9 ? 9 : 18).fill(dflt);
    const wrap = document.createElement("div");
    wrap.className = "modal";
    const stack = document.createElement("div");
    stack.className = "modal-stack";
    const panel = document.createElement("form");
    panel.className = "modal-panel";
    const h = document.createElement("h2");
    h.textContent = pre.pars ? "Check the scorecard" : mini ? "Enter the holes" : "Enter the course";
    panel.append(h);
    const field = (label, ph, max) => {
      const l = document.createElement("label");
      const sp = document.createElement("span");
      sp.textContent = label;
      const i = document.createElement("input");
      i.placeholder = ph;
      i.maxLength = max;
      i.autocomplete = "off";
      l.append(sp, i);
      panel.append(l);
      return i;
    };
    const nameI = mini ? field("Course name (optional)", "Mini-golf", 80) : field("Course name", "e.g. Pine Valley", 80);
    nameI.value = pre.name || "";
    const locI = mini ? null : field("City and state (optional)", "e.g. Austin, TX", 60);
    const teeI = mini ? null : field("Tees (optional)", "e.g. White", 30);
    if (!mini) {
      locI.value = pre.location || "";
      teeI.value = pre.tee_name || "";
    }
    const holeRow = document.createElement("div");
    holeRow.className = "chip-row";
    holeRow.style.marginBottom = "12px";
    const drawHoleRow = () => holeRow.querySelectorAll("button").forEach(b => b.classList.toggle("selected", +b.dataset.n === pars.length));
    if (mini && !pre.lockHoles) {
      [9, 18].forEach(n => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.n = n;
        b.textContent = n + " holes";
        b.onclick = () => {
          if (pars.length === n) return;
          pars = n === 9 ? pars.slice(0, 9) : pars.concat(Array(9).fill(dflt));
          drawHoleRow();
          buildGrid();
          sync();
        };
        holeRow.append(b);
      });
      drawHoleRow();
    }
    const lbl = document.createElement("div");
    lbl.className = "field-label";
    lbl.textContent = "Pars (tap a hole to change it)";
    const grid = document.createElement("div");
    grid.className = "par-grid";
    const total = document.createElement("p");
    total.className = "par-total";
    const sync = () => {
      const out = pars.slice(0, 9).reduce((a, b) => a + b, 0), inn = pars.slice(9).reduce((a, b) => a + b, 0);
      total.textContent = pars.length === 9 ? "Total " + out : "Out " + out + ", In " + inn + ", Total " + (out + inn);
    };
    const sels = [];
    const hcpPre = Array.isArray(pre.hcp_index) && pre.hcp_index.length === 18 ? pre.hcp_index : null;
    const refreshHcp = () => sels.forEach(s => {
      s.btn.textContent = s.value || "\u2013";
      s.btn.classList.toggle("set", !!s.value);
    });
    let pickerEl = null, pickerFor = null;
    const closePicker = () => {
      if (pickerEl) pickerEl.remove();
      if (pickerFor) pickerFor.btn.classList.remove("active");
      pickerEl = null;
      pickerFor = null;
    };
    const openPicker = (s, i) => {
      const same = pickerFor === s;
      closePicker();
      if (same) return;
      pickerFor = s;
      s.btn.classList.add("active");
      pickerEl = document.createElement("div");
      pickerEl.className = "hcp-picker";
      const title = document.createElement("div");
      title.className = "hcp-picker-title";
      title.textContent = "Hole " + (i + 1) + " handicap (1 = hardest)";
      const g = document.createElement("div");
      g.className = "hcp-picker-grid";
      const used = new Set(sels.filter(o => o !== s).map(o => o.value).filter(Boolean));
      for (let n = 1; n <= 18; n++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "hcp-opt" + (s.value === String(n) ? " selected" : "");
        b.textContent = n;
        b.disabled = used.has(String(n));
        b.onclick = () => {
          s.value = String(n);
          refreshHcp();
          const nextI = sels.findIndex((o, k) => k > i && !o.value);
          if (nextI >= 0) openPicker(sels[nextI], nextI); else closePicker();
        };
        g.append(b);
      }
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "link-btn";
      clear.textContent = "Clear this hole";
      clear.style.marginTop = "8px";
      clear.onclick = () => { s.value = ""; refreshHcp(); closePicker(); };
      pickerEl.append(title, g, clear);
      grid.after(pickerEl);
      const first = pickerEl.querySelector(".hcp-opt:not(:disabled)");
      if (first) first.focus({ preventScroll: true });
    };
    const buildGrid = () => {
      closePicker();
      grid.innerHTML = "";
      sels.length = 0;
      pars.forEach((_, i) => {
        const cell = document.createElement("div");
        cell.className = "par-cell";
        const num = document.createElement("small");
        num.textContent = i + 1;
        const arrow = (txt, label) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "par-arrow";
          b.textContent = txt;
          b.setAttribute("aria-label", label + " hole " + (i + 1) + " par");
          return b;
        };
        const up = arrow("\u25B2", "Raise"), down = arrow("\u25BC", "Lower");
        const val = document.createElement("span");
        val.className = "par-val";
        const draw = () => { val.textContent = pars[i]; up.disabled = pars[i] >= hi; down.disabled = pars[i] <= lo; };
        up.onclick = () => { if (pars[i] < hi) { pars[i]++; draw(); sync(); } };
        down.onclick = () => { if (pars[i] > lo) { pars[i]--; draw(); sync(); } };
        const s = { value: hcpPre ? String(hcpPre[i]) : "", btn: document.createElement("button") };
        s.btn.type = "button";
        s.btn.className = "par-hcp";
        s.btn.setAttribute("aria-label", "Hole " + (i + 1) + " handicap");
        s.btn.onclick = () => openPicker(s, i);
        const sel = s.btn;
        sels.push(s);
        draw();
        cell.append(num, up, val, down, sel);
        grid.append(cell);
      });
      refreshHcp();
    };
    buildGrid();
    const hcpToggle = document.createElement("button");
    hcpToggle.type = "button";
    hcpToggle.className = "link-btn";
    hcpToggle.style.marginBottom = "10px";
    const drawToggle = () => {
      const on = grid.classList.contains("show-hcp");
      hcpToggle.textContent = on ? "Remove hole handicaps" : "Add hole handicaps (optional)";
      lbl.textContent = on ? "Pars, then hole handicap (1 = hardest hole)" : "Pars";
    };
    hcpToggle.onclick = () => { closePicker(); grid.classList.toggle("show-hcp"); drawToggle(); };
    if (!mini && (hcpPre || pre.showHcp)) grid.classList.add("show-hcp");
    drawToggle();
    if (mini) hcpToggle.style.display = "none";
    const err = document.createElement("p");
    err.className = "modal-error";
    err.setAttribute("role", "alert");
    const row = document.createElement("div");
    row.className = "modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn-ghost";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.textContent = "Save course";
    row.append(cancel, ok);
    panel.append(holeRow, lbl, grid, total, hcpToggle, err, row);
    if (!holeRow.childElementCount) holeRow.remove();
    stack.append(panel);
    wrap.append(stack);
    document.body.append(wrap);
    sync();
    const close = (v) => { wrap.remove(); resolve(v); };
    cancel.onclick = () => close(null);
    panel.onsubmit = (e) => {
      e.preventDefault();
      if (mini) {
        close({ name: nameI.value.trim() || "Mini-golf", location: null, tee_name: null, pars: pars.slice(), hcp_index: null, source: "manual", mini: true });
        return;
      }
      const name = nameI.value.trim();
      if (name.length < 2) { err.textContent = "Give the course a name."; nameI.focus(); return; }
      let hcp_index = null;
      if (grid.classList.contains("show-hcp")) {
        const v = sels.map(s => Number(s.value));
        if (v.some(n => n)) {
          if (v.some(n => !n) || new Set(v).size !== 18) {
            err.textContent = "Give every hole a different handicap from 1 to 18, or remove them.";
            return;
          }
          hcp_index = v;
        }
      }
      close({ name, location: locI.value.trim() || null, tee_name: teeI.value.trim() || null, pars: pars.slice(), hcp_index, source: "manual" });
    };
  });
}

function teeLabel(t) {
  return t.tee_name + (t.gender === "Female" ? " (Women's)" : "");
}
// Course columns for a chosen tee. No rating on this tee? Borrow a sibling tee's official
// numbers, shifted by the yardage formula. No ratings anywhere? Leave them null and let
// seasons estimate from yardage live.
function teeDifficulty(tee, tees) {
  if (!tee) return { rating: null, slope: null, yardage: null, tee_gender: null, rating_source: null };
  const g = t => (t.gender === "Female" ? "F" : "M");
  const yards = t => (Number(t.yardage) > 0 ? Math.round(Number(t.yardage)) : null);
  const out = { yardage: yards(tee), tee_gender: g(tee) };
  if (Number(tee.course_rating) > 0 && Number(tee.slope) > 0) {
    return { ...out, rating: Number(tee.course_rating), slope: Math.round(Number(tee.slope)), rating_source: "official" };
  }
  const refs = (tees || []).filter(t => t !== tee && Number(t.course_rating) > 0 && Number(t.slope) > 0 && yards(t));
  if (out.yardage && refs.length) {
    const ref = refs.slice().sort((a, b) => (g(a) !== g(tee)) - (g(b) !== g(tee))
      || Math.abs(yards(a) - out.yardage) - Math.abs(yards(b) - out.yardage))[0];
    const fT = yardageEstimate(out.yardage, g(tee)), fR = yardageEstimate(yards(ref), g(ref));
    return { ...out,
      rating: Math.round((Number(ref.course_rating) + fT.rating - fR.rating) * 10) / 10,
      slope: Math.round(Number(ref.slope) + fT.slope - fR.slope),
      rating_source: "tee_estimate" };
  }
  return { ...out, rating: null, slope: null, rating_source: out.yardage ? "yardage" : null };
}
function teeModal(name, tees) {
  return new Promise(resolve => {
    const wrap = document.createElement("div");
    wrap.className = "modal";
    const stack = document.createElement("div");
    stack.className = "modal-stack";
    const panel = document.createElement("div");
    panel.className = "modal-panel";
    const h = document.createElement("h2");
    h.textContent = "Which tees?";
    const sub = document.createElement("p");
    sub.className = "waiting";
    sub.textContent = name;
    const list = document.createElement("ul");
    list.className = "player-list tee-list";
    const close = (v) => { wrap.remove(); resolve(v); };
    tees.slice().sort((a, b) => (b.yardage || 0) - (a.yardage || 0)).forEach(t => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      const left = document.createElement("div");
      const nm = document.createElement("span");
      nm.textContent = teeLabel(t);
      const d = document.createElement("span");
      d.className = "detail";
      d.textContent = [t.yardage ? t.yardage.toLocaleString() + " yds" : "",
        t.course_rating && t.slope ? t.course_rating + " / " + t.slope : ""].filter(Boolean).join(", ");
      left.append(nm, d);
      li.append(left);
      li.onclick = () => close(t);
      list.append(li);
    });
    const cancel = document.createElement("button");
    cancel.className = "btn-ghost";
    cancel.textContent = "Cancel";
    cancel.style.cssText = "width:100%;margin-top:12px";
    cancel.onclick = () => close(undefined);
    panel.append(h, sub, list, cancel);
    stack.append(panel);
    wrap.append(stack);
    document.body.append(wrap);
  });
}

async function shrinkImage(file) {
  let img;
  try { img = await createImageBitmap(file); }
  catch (e) { throw new Error("Couldn't open that photo. Try a JPG or PNG."); }
  const k = Math.min(1, 1568 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

async function loadRoundRanks(roundIds) {
  const ids = [...new Set((roundIds || []).filter(id => id && !(id in ROUND_RANKS)))];
  if (!ids.length) return;
  const { data: rs } = await db.from("rounds").select("id, course_id").in("id", ids);
  const cids = [...new Set((rs || []).map(r => r.course_id).filter(Boolean))];
  const { data: cs } = cids.length ? await db.from("courses").select("id, hcp_index").in("id", cids) : { data: [] };
  (rs || []).forEach(r => {
    const c = (cs || []).find(x => x.id === r.course_id);
    ROUND_RANKS[r.id] = c && Array.isArray(c.hcp_index) && c.hcp_index.length === 18 ? c.hcp_index : null;
  });
}

function startRoundLoading() {
  if (document.body.classList.contains("round-loading")) return;
  document.body.classList.add("round-loading");
  const ld = document.createElement("div");
  ld.id = "round-loader";
  ld.setAttribute("role", "status");
  ld.setAttribute("aria-label", "Loading round");
  document.body.append(ld);
  clearTimeout(window.__roundLoadTimer);
  window.__roundLoadTimer = setTimeout(endRoundLoading, 5000);
}
function endRoundLoading() {
  clearTimeout(window.__roundLoadTimer);
  const ld = document.getElementById("round-loader");
  if (ld) ld.remove();
  if (!document.body.classList.contains("round-loading")) return;
  document.body.classList.remove("round-loading");
  [...document.body.children].forEach(el => {
    if (el.tagName !== "SCRIPT" && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
  });
}

// modalScrollTop: popups always open scrolled to the top
new MutationObserver(muts => {
  muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1 || !n.classList.contains("modal")) return;
    const reset = () => {
      n.scrollTop = 0;
      n.querySelectorAll("*").forEach(el => { if (el.scrollTop) el.scrollTop = 0; });
    };
    requestAnimationFrame(() => { reset(); setTimeout(reset, 60); });
  }));
}).observe(document.body, { childList: true });

function stablefordPoints(x, course, allow) {
  const par = course && Array.isArray(course.pars) ? course.pars[x.hole - 1] : 4;
  return Math.max(0, par - netOf(x, allow) + 2);
}
function stablefordTotals(round, players, scores, course) {
  const allow = holeAllowances(round, players);
  const t = {};
  scores.filter(x => x.strokes).forEach(x => { t[x.player_id] = (t[x.player_id] || 0) + stablefordPoints(x, course, allow); });
  return t;
}

const MONEY_UNITS = {
  party: { unit: "point", note: "Every point is worth this much. At the end, everyone settles the point difference with everyone else." },
  stroke: { unit: "stroke", note: "Every stroke is worth this much. Shoot 85 to their 90 and they owe you 5 strokes' worth." },
  stableford: { unit: "Stableford point", note: "Every Stableford point is worth this much. Everyone settles the point difference at the end." },
  skins: { unit: "skin", note: "Every skin is worth this much. Everyone settles the skins difference at the end." },
  match: { unit: "point", note: "A won hole is 1 point and a halved hole is half. Everyone settles the point difference at the end." },
  wolf: { unit: "point", note: "Every Wolf point is worth this much. Everyone settles the point difference at the end." },
  bbb: { unit: "point", note: "Every Bingo, Bango or Bongo is worth this much. Everyone settles the difference at the end." },
  bestball: { unit: "hole won", note: "Every hole your team wins is worth this much to each teammate. Settle the difference at the end." },
  sixes: { unit: "point", note: "Winning a set is 1 point each, a tied set is half. Everyone settles the point difference at the end. With Nassau bets, every bet, press and birdie wins this much from the other team." },
  nassau: { unit: "bet", note: "Front, back, overall and every press is one bet. Win it and you collect from the other side, halve it and nobody pays." },
  vegas: { unit: "point", note: "Every Vegas point (the difference between team numbers) is worth this much. Settle up at the end." },
  wad: { unit: "Wad", note: "Whoever makes the last Wad collects the whole pot from everyone else in their group." },
  caddy: { unit: "Caddy Point", note: "Every Caddy Point is worth this much. Caddies settle the point difference at the end." },
};

async function myHandicap() {
  try {
    const { data: { session } } = await db.auth.getSession();
    const md = (session && session.user && session.user.user_metadata) || {};
    return md.usual_score ? { usual: md.usual_score, hcp: md.hcp ?? null } : null;
  } catch (e) { return null; }
}
async function saveMyHandicap(hc) {
  if (!hc || !hc.usual) return;
  try { await db.auth.updateUser({ data: { usual_score: hc.usual, hcp: hc.hcp } }); } catch (e) {}
}

// ---------- Outfit: account in user_metadata.outfit, guests in localStorage ----------
const OUTFIT_KEY = "parcade-outfit";
function guestOutfit() {
  try { const v = localStorage.getItem(OUTFIT_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
// Shop gear the account doesn't own is swapped for the default (the database does the same on player rows).
// If the shop couldn't be reached, the outfit is left as saved and the server still strips it in rounds.
async function myOutfit() {
  await loadShop();
  let fit;
  try {
    const { data: { session } } = await db.auth.getSession();
    const u = session && session.user;
    const md = (u && !u.is_anonymous && u.user_metadata) || {};
    fit = normalizeOutfit(md.outfit || guestOutfit());
  } catch (e) { fit = normalizeOutfit(guestOutfit()); }
  return SHOP.ready ? ownedOutfit(fit) : fit;
}
// Returns an error message, or null when saved. Outfits with unowned shop gear are refused.
async function saveMyOutfit(o) {
  const fit = normalizeOutfit(o);
  await loadShop();
  const missing = unownedPieces(fit);
  if (missing.length) {
    if (SHOP.failed) return "Couldn't check your gear with the Pro Shop. Try again in a sec.";
    return "You don't own the " + missing.join(" or the ") + " yet. Buy " + (missing.length > 1 ? "them" : "it") + " or take " +
      (missing.length > 1 ? "them" : "it") + " off before you save.";
  }
  try {
    const { data: { session } } = await db.auth.getSession();
    const u = session && session.user;
    if (u && !u.is_anonymous) {
      const { error } = await db.auth.updateUser({ data: { outfit: fit } });
      return error ? error.message : null;
    }
  } catch (e) { return e.message; }
  try { localStorage.setItem(OUTFIT_KEY, JSON.stringify(fit)); } catch (e) { return "Couldn't save on this device."; }
  return null;
}
// ---------- Pro Shop data (supabase/pro-shop.sql) ----------
// Prices, owned gear and the coin balance, copied into SHOP (outfits.js) for drawing. Reloaded when the signed-in
// account changes or after a purchase; the database decides everything, this only reads.
let shopLoading = null;
async function loadShop(force) {
  let u = null;
  try { const { data: { session } } = await db.auth.getSession(); u = session && session.user; } catch (e) {}
  const uid = (u && u.id) || null;
  if (!force && shopLoading && SHOP.userId === uid) return shopLoading;
  if (SHOP.userId !== uid) { SHOP.owned = new Set(); SHOP.balance = 0; SHOP.ready = false; }
  SHOP.userId = uid;
  SHOP.signedIn = !!(u && !u.is_anonymous);
  const signed = SHOP.signedIn;
  const load = shopLoading = (async () => {
    const [items, coins, owned] = await Promise.all([
      db.from("shop_items").select("id, price, active"),
      signed ? db.from("user_coins").select("balance").maybeSingle() : { data: null },
      signed ? db.from("user_items").select("item_id") : { data: [] }]);
    const err = items.error || coins.error || owned.error;
    if (err) throw err;
    if (SHOP.userId !== uid) return;
    SHOP.prices = Object.fromEntries((items.data || []).map(r => [r.id, { price: r.price, active: r.active }]));
    SHOP.balance = (coins.data && coins.data.balance) || 0;
    SHOP.owned = new Set((owned.data || []).map(r => r.item_id));
    SHOP.ready = true;
    SHOP.failed = false;
  })().catch(() => { SHOP.failed = true; if (shopLoading === load) shopLoading = null; });
  return load;
}
const COIN_SVG = '<svg class="coin-ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="7" fill="#FFD84D" stroke="#C99A1E" stroke-width="1.5"/>' +
  '<circle cx="8" cy="8" r="3.8" fill="none" stroke="#C99A1E" stroke-width="1.3"/></svg>';
const coinsText = n => n + (n === 1 ? " coin" : " coins");
// Coin balance for a screen header, plus the guest note. Call update() after the balance changes.
function coinUI() {
  const badge = document.createElement("span");
  badge.className = "coin-badge coin-tap";
  badge.setAttribute("role", "button");
  badge.tabIndex = 0;
  badge.onclick = e => { e.stopPropagation(); coinMenu(badge); };
  badge.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); coinMenu(badge); } };
  const note = document.createElement("p");
  note.className = "coin-note";
  note.textContent = "Create an account to earn and spend coins.";
  const update = () => {
    badge.hidden = !SHOP.signedIn;
    note.hidden = SHOP.signedIn;
    badge.innerHTML = COIN_SVG + "<b>" + SHOP.balance + "</b>";
    badge.setAttribute("aria-label", coinsText(SHOP.balance));
    badge.title = coinsText(SHOP.balance);
  };
  update();
  return { badge, note, update };
}
// Asks to confirm, then buys through buy_item. True when the piece is now owned.
async function buyPiece(id) {
  const it = OUTFIT_PIECES[id].piece, row = SHOP.prices[id];
  if (!SHOP.signedIn) {
    const pick = await pickFrom("Create an account to earn and spend coins", [
      { label: "Create account", value: "create" }, { label: "Sign in", value: "signin" }]);
    if (pick === "create") await createAccount();
    if (pick === "signin" && await signIn()) renderAccount();
    await loadShop(true);
    return false;
  }
  if (!row || !row.active) { toast("That one's not for sale right now."); return false; }
  if (SHOP.balance < row.price) { toast("You need " + coinsText(row.price - SHOP.balance).replace(/ (coins?)$/, " more $1") + "."); return false; }
  const left = SHOP.balance - row.price;
  const pick = await pickFrom("Buy the " + it.name + " for " + coinsText(row.price) + "? You'll have " + left + " left.",
    [{ label: "Buy for " + coinsText(row.price), value: "buy" }]);
  if (pick !== "buy") return false;
  const { data, error } = await db.rpc("buy_item", { p_item: id });
  if (error) {
    toast(/already own/i.test(error.message) ? "You already own that." : error.message);
    await loadShop(true);
    return SHOP.owned.has(id);
  }
  SHOP.balance = data;
  SHOP.owned.add(id);
  Sound.play("coin");
  return true;
}

// Insert a players row. If supabase/character.sql hasn't been run yet, retry without the outfit column.
async function insertPlayer(row) {
  let res = await db.from("players").insert(row);
  if (res.error && "outfit" in row && /outfit/i.test(res.error.message || "")) {
    const { outfit, ...rest } = row;
    res = await db.from("players").insert(rest);
  }
  return res;
}

// gateHomeButtons: homescreen buttons need a signed-in account
const HOME_GATED = ["Customize Character", "Seasons", "Tournaments", "Recent rounds"];
let homeSignedIn = false;
function homeGatedButtons() {
  return [...document.querySelectorAll("button")].filter(b =>
    !b.closest(".modal") && !b.closest(".lobby") && !b.closest(".season-box") && (HOME_GATED.includes(b.textContent.trim()) || b.classList.contains("app-nav-btn")));
}
function gateHomeButtons(signedIn) {
  homeSignedIn = signedIn;
  homeGatedButtons().forEach(b => {
    b.classList.toggle("locked-home", !signedIn);
    b.setAttribute("aria-disabled", String(!signedIn));
  });
  let note = document.getElementById("home-lock-note");
  const first = homeGatedButtons().find(b => b.offsetParent !== null);
  if (!signedIn && first && !note) {
    note = document.createElement("p");
    note.id = "home-lock-note";
    note.className = "home-lock-note";
    note.textContent = "\u{1F512} Sign in to customize your character, join seasons and tournaments, and see your rounds.";
    first.before(note);
  }
  if (note) note.style.display = signedIn ? "none" : "";
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest && e.target.closest("button.locked-home");
  if (!b || homeSignedIn) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const pick = await pickFrom("You'll need an account for that", [
    { label: "Create account", value: "create" },
    { label: "Sign in", value: "signin" }
  ]);
  if (pick === "create") await createAccount();
  if (pick === "signin" && await signIn()) renderAccount();
}, true);

// ---------- Profile ----------
async function openProfile() {
  const { data: { session } } = await db.auth.getSession();
  const u = session && session.user;
  if (!u || u.is_anonymous) { if (await signIn()) renderAccount(); return; }
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const wrap = mk("div", "modal");
  const stack = mk("div", "modal-stack");
  const panel = mk("div", "modal-panel profile-panel");
  const close = () => { wrap.remove(); renderAccount(); };
  wrap.onclick = e => { if (e.target === wrap) close(); };
  const section = title => { const sec = mk("div", "profile-sec"); sec.append(mk("div", "profile-head", title)); panel.append(sec); return sec; };
  const row = (label, hint, control) => {
    const r = mk("div", "toggle-row od-row");
    const txt = mk("div");
    txt.append(mk("span", "field-label", label));
    if (hint) txt.append(mk("small", null, hint));
    r.append(txt, control);
    return r;
  };
  let md = u.user_metadata || {};

  panel.append(mk("h2", null, "Your profile"));
  await loadClub();

  // Name
  const nameSec = section("Preferred name");
  if (tier() === "club") nameSec.firstChild.append(clubBadge());
  const nameRow = mk("div", "profile-inline");
  const nameIn = mk("input");
  nameIn.value = md.first_name || "";
  nameIn.maxLength = 30;
  nameIn.placeholder = "What your crew calls you";
  nameIn.autocomplete = "given-name";
  nameIn.setAttribute("aria-label", "Preferred name");
  const nameSave = mk("button", null, "Save");
  nameSave.onclick = async () => {
    const v = nameIn.value.trim();
    if (v.length < 1) { toast("Give us a name."); return; }
    const { data, error } = await db.auth.updateUser({ data: { first_name: v } });
    if (error) { toast(error.message); return; }
    md = (data && data.user && data.user.user_metadata) || md;
    toast("Name saved.");
  };
  nameRow.append(nameIn, nameSave);
  nameSec.append(nameRow, mk("small", "profile-note", "Fills in automatically when you start or join a round."));

  // Handicap
  const hcSec = section("Handicap");
  const hcVal = mk("b");
  const drawHc = () => {
    hcVal.textContent = md.hcp != null ? (md.hcp < 0 ? "+" + Math.abs(md.hcp) : String(md.hcp))
      : md.usual_score ? "Shoots " + md.usual_score : "Not set";
  };
  drawHc();
  const hcBtn = mk("button", "mini", "Change");
  hcBtn.onclick = async () => {
    const hc = await askHandicap(null, { hcp: md.hcp, usual: md.usual_score }, true);
    if (!hc) return;
    await saveMyHandicap(hc);
    md = { ...md, usual_score: hc.usual, hcp: hc.hcp };
    drawHc();
    toast("Handicap saved.");
  };
  hcSec.append(row("Your handicap", "Applied automatically to rounds with handicaps on.", (() => { const c = mk("div", "profile-inline"); c.append(hcVal, hcBtn); return c; })()));


  // Settings
  const setSec = section("Settings");
  const sw = (get, set) => {
    const b = mk("button", "switch");
    b.type = "button";
    b.setAttribute("role", "switch");
    const sync = () => { const on = get(); b.classList.toggle("on", on); b.textContent = on ? "On" : "Off"; b.setAttribute("aria-checked", String(on)); };
    b.onclick = () => { set(!get()); sync(); if (get()) Sound.play("pop"); };
    sync();
    return b;
  };
  setSec.append(
    row("Sound effects", "Reveals, scores and chat pings.", sw(() => Sound.sfxOn, v => Sound.setSfx(v))),
    row("Music", "Plays on the home and setup screens.", sw(() => Sound.musicOn, v => Sound.setMusic(v))));
  const look = mk("div", "od-row theme-row");
  look.append(mk("span", "field-label", "Appearance"));
  const lookPick = mk("div", "theme-pick");
  lookPick.setAttribute("role", "radiogroup");
  lookPick.setAttribute("aria-label", "Appearance");
  const lookBtns = [["dark", "Dark"], ["light", "Light"], ["system", "Match my phone"]].map(([val, label]) => {
    const b = mk("button", "switch", label);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.onclick = () => { setThemePref(val); syncLook(); };
    return [val, b];
  });
  const syncLook = () => lookBtns.forEach(([val, b]) => {
    const on = themePref() === val;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", String(on));
  });
  syncLook();
  lookPick.append(...lookBtns.map(([, b]) => b));
  look.append(lookPick);
  setSec.append(look);
  const pw = mk("button", "btn-ghost", "Change password");
  pw.style.cssText = "width:100%;margin-top:10px";
  pw.onclick = async () => {
    const v = await ask("Change password", [{ label: "New password", type: "password", placeholder: "At least 8 characters", max: 72 }], "Save", null,
      async ([p]) => {
        if (!p || p.length < 8) return "Use at least 8 characters.";
        const { error } = await db.auth.updateUser({ password: p });
        return error ? friendlyAuthError(error) : null;
      });
    if (v) toast("Password updated.");
  };
  setSec.append(pw);

  // Account
  const acSec = section("Account");
  acSec.append(mk("p", "waiting", "Signed in as " + (u.email || "your account")));
  const out = mk("button", "btn-ghost", "Sign out");
  out.style.cssText = "width:100%";
  out.onclick = () => { wrap.remove(); signOut(); };
  const links = mk("div", "profile-links");
  [["Terms", "/terms"], ["Privacy", "/privacy"], ["support@parcade.golf", "mailto:support@parcade.golf"]].forEach(([t, h]) => {
    const a = mk("a", null, t);
    a.href = h;
    if (h.startsWith("/")) a.target = "_blank";
    links.append(a);
  });
  acSec.append(out, links);

  const done = mk("button", null, "Done");
  done.style.cssText = "width:100%;margin-top:18px";
  done.onclick = close;
  panel.append(done);
  stack.append(panel);
  wrap.append(stack);
  document.body.append(wrap);
}

// ---------- Dressing room ----------
// Wardrobe from briefs/character-lab.html: each tab is style tiles and/or color swatches.
const DRESS_TABS = [["body", "Body"], ["hair", "Hair"], ["shirt", "Shirt"], ["pants", "Pants"], ["shoes", "Shoes"], ["hat", "Hats"], ["item", "Items"]];
const DRESS_PANELS = {
  body: [["swatch", "Skin tone", "skin"], ["swatch", "Eye color", "eyes"]],
  hair: [["tiles", "Style", "hair"], ["swatch", "Hair color", "hairColor"], ["tiles", "Facial hair", "face"]],
  shirt: [["tiles", "Style", "shirt"], ["swatch", "Color", "shirtColor"]],
  pants: [["tiles", "Style", "pants"], ["swatch", "Color", "pantsColor"]],
  shoes: [["tiles", "Style", "shoes"], ["swatch", "Color", "shoeColor"]],
  hat: [["tiles", "Style", "hat"], ["swatch", "Color", "hatColor"]],
  item: [["tiles", "Held item", "item"]],
};
// App only: category icons for the dressing room tabs, and short sub-tab names
const DRESS_ICONS = (() => {
  const ic = d => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  return {
    body: ic('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'),
    hair: ic('<rect x="3" y="7" width="18" height="5" rx="1.5"/><path d="M6 12v6M9 12v6M12 12v6M15 12v6M18 12v6"/>'),
    shirt: ic('<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/>'),
    pants: ic('<path d="M7 3h10l2 18h-5l-2-11-2 11H5z"/>'),
    shoes: ic('<path d="M3 7h6l3 5 6 1.5c2 .5 3 1.5 3 3.5v1H3z"/><path d="M3 15h18"/>'),
    hat: ic('<path d="M4 15a8 8 0 0 1 16 0z"/><path d="M4 15h17l-2 3H4z"/>'),
    item: ic('<path d="M15 3L9.5 17"/><path d="M9.5 17H5.5c-1 0-1.5 1-1 2h6l-1-2z"/><circle cx="18" cy="19" r="2"/>'),
  };
})();
const DRESS_SUB_NAME = { skin: "Skin", eyes: "Eyes", hairColor: "Color", face: "Facial hair" };
const DRESS_PAGE = 6;
const needText = n => "You need " + n + " more " + (n === 1 ? "coin" : "coins") + ".";
// Wardrobe list for a slot: Bogey pieces first (in their order), then shop pieces cheapest tier first
const shopSorted = list => list.map((it, i) => [it, i]).sort((a, b) => RARITY_RANK[a[0].rarity] - RARITY_RANK[b[0].rarity] || a[1] - b[1]).map(x => x[0]);
// The lock / price / owned line under a shop tile
function pieceTag(it, mk) {
  const row = SHOP.prices[it.id];
  if (outfitOwned(it.id)) return mk("span", "dress-owned", "Owned");
  const t = mk("span", "dress-lock");
  if (!SHOP.ready) t.textContent = "\u{1F512} Shop's closed";
  else if (!row || !row.active) t.textContent = "\u{1F512} Sold out";
  else t.innerHTML = "\u{1F512} " + COIN_SVG + "<b>" + row.price + "</b>";
  return t;
}
// A tile's text column: name, then rarity tag, then lock / price / owned (one box on the website, stacked beside the sprite in the app)
function tileText(mk, ...parts) {
  const t = mk("span", "dress-tile-text");
  t.append(...parts);
  return t;
}
// App only: the category icon tab, shared by the dressing room and Pro Shop
function iconTab(b, key, label) {
  b.classList.add("dress-itab");
  b.innerHTML = DRESS_ICONS[key] + "<span>" + label + "</span>";
}
// App only: an x on Crabby's bubble hides him behind a "Show Crabby" button in the top bar, and while he's hidden his
// lines show as toasts. Remembered, and shared by the dressing room and Pro Shop. sync() picks up a change made in the other.
const CRABBY_OFF_KEY = "parcade-dress-crabby-off";
function crabbyHideable(guide, top, before, lines) {
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const isOff = () => { try { return localStorage.getItem(CRABBY_OFF_KEY) === "1"; } catch (e) { return false; } };
  let off = isOff();
  const say = guide.say;
  // Hidden Crabby stays quiet: only lines that block an action still pop up
  const IMPORTANT = new Set([CRABBY_DRESS.locked, CRABBY_SHOP.closed]);
  guide.say = text => off ? (IMPORTANT.has(text) && toast(text)) : say(text);
  const hideX = mk("button", "cd-x", "\u00D7");
  hideX.type = "button";
  hideX.setAttribute("aria-label", "Hide Crabby");
  guide.querySelector(".cd-bubble").append(hideX);
  const show = mk("button", "dress-crabby-show");
  show.type = "button";
  show.setAttribute("aria-label", "Show Crabby");
  show.title = "Show Crabby";
  const face = crabbyEl(26);
  face.setAttribute("aria-hidden", "true");
  face.removeAttribute("role");
  show.append(face);
  const set = v => {
    off = v;
    guide.hidden = v;
    show.hidden = !v;
    try { if (v) localStorage.setItem(CRABBY_OFF_KEY, "1"); else localStorage.removeItem(CRABBY_OFF_KEY); } catch (e) {}
  };
  hideX.onclick = () => { set(true); show.focus(); };
  show.onclick = () => { set(false); guide.reserve(lines); hideX.focus(); };
  set(off);
  top.insertBefore(show, before);
  return { sync: () => { if (isOff() !== off) { set(!off); if (!off) guide.reserve(lines); } } };
}
// App only: the < 1 / 2 > pager under a 2x3 grid, with swipe left / right on the grid. slice() gives one page of a
// list (at: an index whose page to jump to); single() is for content that's never paged.
function dressPager(grid, redraw) {
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const el = mk("div", "dress-pager");
  const prev = mk("button", "btn-ghost dress-page-btn", "\u2039");
  const next = mk("button", "btn-ghost dress-page-btn", "\u203A");
  const pageNo = mk("span", "dress-page-no");
  prev.type = next.type = "button";
  prev.setAttribute("aria-label", "Previous page");
  next.setAttribute("aria-label", "Next page");
  el.append(prev, pageNo, next);
  const p = { el, page: 0, count: 1 };
  const turn = d => { if (p.page + d < 0 || p.page + d >= p.count) return; p.page += d; redraw(); };
  prev.onclick = () => turn(-1);
  next.onclick = () => turn(1);
  let sx = null, sy = 0;
  grid.addEventListener("touchstart", e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener("touchend", e => {
    if (sx == null) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  });
  const sync = () => {
    el.classList.toggle("off", p.count < 2);
    prev.disabled = p.page === 0;
    next.disabled = p.page >= p.count - 1;
    pageNo.textContent = (p.page + 1) + " / " + p.count;
  };
  p.slice = (list, at) => {
    p.count = Math.max(1, Math.ceil(list.length / DRESS_PAGE));
    if (at != null) p.page = Math.max(0, Math.floor(at / DRESS_PAGE));
    p.page = Math.min(p.page, p.count - 1);
    sync();
    return list.slice(p.page * DRESS_PAGE, (p.page + 1) * DRESS_PAGE);
  };
  p.single = () => { p.count = 1; p.page = 0; sync(); };
  return p;
}
const pieceLabel = it => {
  const row = SHOP.prices[it.id];
  return it.name + ", " + RARITY_NAME[it.rarity] + (outfitOwned(it.id) ? ", owned" : row ? ", locked, " + coinsText(row.price) : ", locked");
};

function openDressingRoom() {
  return new Promise(async resolve => {
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    let saved = await myOutfit();
    let cur = { ...saved };
    let tab = "body", pose = "idle";
    // App only: which sub-tab each category is on, and whether to jump to the equipped piece's page
    const inApp = document.documentElement.classList.contains("in-app");
    const subIdx = {};
    let jump = true;
    const name = (await accountName()) || "Guest";
    const opener = document.activeElement;

    const wrap = mk("div", "dress");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Customize character");
    const top = mk("div", "dress-top");
    const back = mk("button", "btn-ghost dress-back", "Back");
    back.type = "button";
    const coins = coinUI();
    top.append(back, mk("h2", null, "Dressing room"), coins.badge);

    const main = mk("div", "dress-main");
    const stage = mk("div", "dress-stage");
    const fig = mk("div", "dress-fig");
    fig.setAttribute("role", "img");
    fig.setAttribute("aria-label", "Your character");
    const seg = mk("div", "dress-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Pose");
    const poseBtns = [["idle", "Standing"], ["cheer", "Winner"]].map(([key, label]) => {
      const b = mk("button", null, label);
      b.type = "button";
      b.dataset.pose = key;
      b.onclick = () => { pose = key; draw(); };
      return b;
    });
    seg.append(...poseBtns);
    const shopBtn = mk("button", "dress-shop-btn");
    shopBtn.type = "button";
    shopBtn.innerHTML = COIN_SVG + "<span>Pro Shop</span>";
    if (inApp) {
      const ctl = mk("div", "dress-stage-ctl");
      ctl.append(seg, shopBtn);
      stage.append(fig, mk("div", "dress-pedestal"), mk("div", "dress-name", name), ctl);
    } else stage.append(fig, mk("div", "dress-pedestal"), mk("div", "dress-name", name), seg, shopBtn);
    const tabs = mk("div", "dress-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Wardrobe");
    const tabBtns = DRESS_TABS.map(([key, label]) => {
      const b = mk("button", "dress-tab", label);
      if (inApp) iconTab(b, key, label);
      b.type = "button";
      b.id = "dress-tab-" + key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "dress-grid");
      b.onclick = () => { if (tab !== key) jump = true; tab = key; draw(); };
      return b;
    });
    tabs.append(...tabBtns);
    tabs.onkeydown = e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const i = DRESS_TABS.findIndex(([k]) => k === tab), d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      tab = DRESS_TABS[(i + d + DRESS_TABS.length) % DRESS_TABS.length][0];
      jump = true;
      draw();
      tabBtns.find(b => b.id === "dress-tab-" + tab).focus();
    };
    main.append(stage, tabs);

    const grid = mk("div", "dress-grid");
    grid.id = "dress-grid";
    grid.setAttribute("role", "tabpanel");
    // Try-on bar: one row per unowned shop piece being previewed, with Buy / Take off
    const tryBar = mk("div", "dress-try");
    tryBar.setAttribute("aria-live", "polite");
    const actions = mk("div", "dress-actions");
    const btn = (label, cls, fn) => { const b = mk("button", cls, label); b.type = "button"; b.onclick = fn; return b; };
    const guide = crabbyDesk(CRABBY_DRESS.open);
    const crabbyLines = [CRABBY_DRESS.open, CRABBY_DRESS.tryOn, CRABBY_DRESS.locked, CRABBY_DRESS.equipped, ...CRABBY_DRESS.saved];
    guide.reserve(crabbyLines);
    // Stage, tabs, grid and Crabby scroll in their own area; the action bar stays put below it, never over a tile
    const body = mk("div", "dress-body");
    // App only: one screen, no scrolling. Icon tabs, stage, sub-tabs and a paged 2x3 grid; Crabby can be hidden.
    const subs = mk("div", "dress-seg dress-subs");
    subs.setAttribute("role", "group");
    let pager = null, crabby = null;
    if (inApp) {
      wrap.classList.add("dress-v3");
      crabby = crabbyHideable(guide, top, coins.badge, crabbyLines);
      pager = dressPager(grid, () => draw());
      // Nothing on this screen scrolls, so stop the WebView rubber-banding
      wrap.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
      body.append(guide, coins.note, tabs, stage, subs, grid, pager.el);
      wrap.append(top, body, tryBar, actions);
    } else {
      body.append(guide, coins.note, main, grid);
      const scroller = mk("div", "dress-scroll");
      scroller.append(body);
      wrap.append(top, scroller, tryBar, actions);
    }

    const dirty = () => JSON.stringify(cur) !== JSON.stringify(saved);
    const sprite = (o, cls) => { const s = mk("span", cls); s.innerHTML = PX.svg(o, "idle"); return s; };
    function tile(label, figure, selected, onPick, piece) {
      const shop = piece && piece.rarity !== "bogey";
      const b = mk("button", "dress-tile" + (selected ? " selected" : "") + (shop ? " shop-piece r-" + piece.rarity : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", String(selected));
      b.setAttribute("aria-label", shop ? pieceLabel(piece) : label + (piece && piece.name !== "None" ? ", " + RARITY_NAME[piece.rarity] : ""));
      const text = tileText(mk, mk("span", "dress-tile-name", label));
      if (piece && piece.name !== "None") text.append(mk("span", "dress-rarity r-" + piece.rarity, RARITY_NAME[piece.rarity]));
      if (shop) {
        text.append(pieceTag(piece, mk));
        if (!outfitOwned(piece.id)) b.classList.add("locked");
      }
      b.append(figure, text);
      b.onclick = onPick;
      return b;
    }
    function group(title, content) {
      const g = mk("div", "dress-group");
      g.append(mk("h3", null, title), content);
      return g;
    }
    const wardrobe = key => shopSorted(OUTFIT_SLOTS[key]).filter(it => outfitOwned(it.id) || cur[key] === it.id);
    function tileFor(key, it) {
      // Hair and facial hair tiles go without the hat so the hair shows
      const bare = key === "hair" || key === "face" ? { hat: null } : {};
      return tile(it.name, sprite({ ...cur, ...bare, [key]: it.id }, "dress-px"), cur[key] === it.id,
        () => {
          cur[key] = it.id;
          if (!outfitOwned(it.id)) guide.say(CRABBY_DRESS.tryOn);
          draw();
        }, it);
    }
    function tilesFor(title, key) {
      const row = mk("div", "dress-tiles");
      wardrobe(key).forEach(it => row.append(tileFor(key, it)));
      return group(title, row);
    }
    function swatchesFor(title, key) {
      const row = mk("div", "dress-swatches");
      OUTFIT_COLOR_FIELDS[key].forEach((c, i) => {
        const b = mk("button", "dress-sw");
        b.type = "button";
        b.style.background = c;
        b.setAttribute("aria-label", title + " " + (i + 1));
        b.setAttribute("aria-pressed", String(cur[key].toUpperCase() === c.toUpperCase()));
        b.onclick = () => { cur[key] = c; draw(); };
        row.append(b);
      });
      return inApp ? row : group(title, row);
    }
    // App only: the sub-tab's tiles, one page of six at a time (swatches all fit on one page)
    function drawPaged() {
      const panels = DRESS_PANELS[tab];
      const si = Math.min(subIdx[tab] || 0, panels.length - 1);
      subs.hidden = panels.length < 2;
      subs.setAttribute("aria-label", DRESS_TABS.find(([k]) => k === tab)[1]);
      subs.replaceChildren(...(panels.length < 2 ? [] : panels.map(([, title, key], i) => {
        const b = mk("button", null, DRESS_SUB_NAME[key] || title);
        b.type = "button";
        b.setAttribute("aria-pressed", String(i === si));
        b.onclick = () => { if (i !== si) jump = true; subIdx[tab] = i; draw(); };
        return b;
      })));
      const [kind, title, key] = panels[si];
      if (kind === "tiles") {
        const list = wardrobe(key);
        const shown = pager.slice(list, jump ? list.findIndex(it => it.id === cur[key]) : null);
        const row = mk("div", "dress-tiles");
        row.setAttribute("aria-label", title + (pager.count > 1 ? ", page " + (pager.page + 1) + " of " + pager.count : ""));
        row.append(...shown.map(it => tileFor(key, it)));
        grid.replaceChildren(row);
      } else {
        pager.single();
        grid.replaceChildren(swatchesFor(title, key));
      }
      jump = false;
    }
    // What a slot goes back to when an unowned piece comes off: the saved piece, or the default
    const takeOff = slot => { cur[slot] = outfitOwned(saved[slot]) ? saved[slot] : DEFAULT_OUTFIT[slot]; draw(); };
    function drawTryBar() {
      const slots = Object.keys(OUTFIT_SLOTS).filter(slot => !outfitOwned(cur[slot]));
      tryBar.hidden = !slots.length;
      wrap.classList.toggle("trying", !!slots.length);
      tryBar.replaceChildren(...slots.map(slot => {
        const it = OUTFIT_PIECES[cur[slot]].piece, row = SHOP.prices[it.id];
        const line = mk("div", "dress-try-row");
        const info = mk("div", "dress-try-info");
        info.append(mk("b", null, (inApp ? "" : "Trying on: ") + it.name), mk("span", "dress-rarity r-" + it.rarity, RARITY_NAME[it.rarity]));
        const btns = mk("div", "dress-try-btns");
        if (!SHOP.signedIn) btns.append(btn("Create account to buy", "", () => buyPiece(it.id).then(after)));
        else if (!SHOP.ready || !row || !row.active) btns.append(mk("span", "dress-try-note", SHOP.ready ? "Not for sale right now." : "The Pro Shop's closed. Try again soon."));
        else if (SHOP.balance >= row.price) {
          const buy = btn("", "dress-buy", async () => {
            buy.disabled = true;
            if (await buyPiece(it.id)) guide.say(CRABBY_SHOP.bought[Math.floor(Math.random() * CRABBY_SHOP.bought.length)]);
            after();
          });
          buy.innerHTML = "Buy for " + COIN_SVG + "<b>" + row.price + "</b>";
          buy.setAttribute("aria-label", "Buy the " + it.name + " for " + coinsText(row.price));
          btns.append(buy);
        } else {
          const get = btn("Get coins", "btn-ghost dress-get", () => guide.say(CRABBY_SHOP.getCoins));
          btns.append(mk("span", "dress-try-note", needText(row.price - SHOP.balance)), get);
        }
        btns.append(btn("Take off", "btn-ghost", () => takeOff(slot)));
        line.append(info, btns);
        return line;
      }));
    }
    function after() { coins.update(); draw(); }
    function draw() {
      fig.innerHTML = PX.svg(cur, pose);
      poseBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pose === pose)));
      tabBtns.forEach((b, i) => {
        const on = DRESS_TABS[i][0] === tab;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });
      grid.setAttribute("aria-labelledby", "dress-tab-" + tab);
      if (inApp) drawPaged();
      else grid.replaceChildren(...DRESS_PANELS[tab].map(([kind, title, key]) => kind === "tiles" ? tilesFor(title, key) : swatchesFor(title, key)));
      drawTryBar();
      saveBtn.disabled = !dirty();
    }
    // Saving with unowned gear on is refused with saveMyOutfit's message
    async function save() {
      if (unownedPieces(cur).length) guide.say(CRABBY_DRESS.locked);
      const err = await saveMyOutfit(cur);
      if (err) { toast(err); return false; }
      saved = { ...cur };
      return true;
    }
    const saveBtn = btn("Save", "", async () => {
      saveBtn.disabled = true;
      if (!await save()) { saveBtn.disabled = false; return; }
      Sound.play("pop");
      guide.say(CRABBY_DRESS.saved[Math.floor(Math.random() * CRABBY_DRESS.saved.length)]);
      draw();
    });
    actions.append(
      btn("Randomize", "btn-ghost", () => {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const next = { v: 2 };
        Object.entries(OUTFIT_SLOTS).forEach(([slot, list]) => { next[slot] = pick(list.filter(it => outfitOwned(it.id))).id; });
        Object.entries(OUTFIT_COLOR_FIELDS).forEach(([k, list]) => { next[k] = pick(list); });
        cur = normalizeOutfit(next);
        draw();
      }),
      btn("Reset", "btn-ghost", () => { cur = { ...DEFAULT_OUTFIT }; draw(); }),
      saveBtn);

    shopBtn.onclick = async () => {
      const equip = await openProShop(cur);
      if (crabby) crabby.sync();
      await loadShop();
      if (equip) {
        cur[OUTFIT_PIECES[equip].slot] = equip;
        jump = true;
        guide.say(CRABBY_DRESS.equipped);
      }
      after();
    };

    const finish = () => {
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("dress-open");
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      resolve(saved);
    };
    async function leave() {
      if (!dirty()) return finish();
      const pick = await pickFrom("Save your new look?", [{ label: "Save", value: "save" }, { label: "Discard changes", value: "discard" }]);
      if (pick === "discard") return finish();
      if (pick !== "save") return;
      if (!await save()) return;
      toast(CRABBY_DRESS.saved[Math.floor(Math.random() * CRABBY_DRESS.saved.length)]);
      finish();
    }
    const onKey = e => { if (e.key === "Escape" && !document.querySelector(".dress ~ .modal, .pshop")) leave(); };
    back.onclick = leave;
    document.addEventListener("keydown", onKey);
    document.body.classList.add("dress-open");
    document.body.append(wrap);
    draw();
    setTimeout(() => back.focus({ preventScroll: true }), 50);
  });
}

// ---------- Pro Shop ----------
// Crabby's counter, category tabs and item tiles, with a live preview on the player's own character.
// Resolves with a piece id when the player taps Equip it, otherwise null.
const SHOP_TABS = [["hat", "Hats"], ["shirt", "Shirts"], ["pants", "Pants"], ["shoes", "Shoes"], ["item", "Items"]];
function openProShop(outfit) {
  return new Promise(async resolve => {
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const btn = (label, cls, fn) => { const b = mk("button", cls, label); b.type = "button"; b.onclick = fn; return b; };
    await loadShop(true);
    const base = { ...outfit };
    let tab = "hat", pick = null, pose = "idle";
    const opener = document.activeElement;
    // App only: one screen like the dressing room, with icon tabs, a paged 2x3 grid and Buy / Equip pinned at the bottom
    const inApp = document.documentElement.classList.contains("in-app");
    let jump = true;

    const wrap = mk("div", "dress pshop");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Pro Shop");
    const top = mk("div", "dress-top");
    const back = btn("Back", "btn-ghost dress-back", () => finish(null));
    const coins = coinUI();
    top.append(back, mk("h2", null, "Pro Shop"), coins.badge);

    const lines = SHOP.signedIn ? CRABBY_SHOP.open : CRABBY_SHOP.guest;
    const guide = crabbyDesk(SHOP.failed ? CRABBY_SHOP.closed : lines[Math.floor(Math.random() * lines.length)]);
    const crabbyLines = [...CRABBY_SHOP.open, ...CRABBY_SHOP.guest, ...CRABBY_SHOP.bought, ...CRABBY_SHOP.browse,
      CRABBY_SHOP.closed, CRABBY_SHOP.short, CRABBY_SHOP.getCoins, CRABBY_SHOP.owned];
    guide.reserve(crabbyLines);
    guide.classList.add("pshop-desk");

    const stage = mk("div", inApp ? "dress-stage pshop-stage" : "pshop-stage");
    const fig = mk("div", "dress-fig pshop-fig");
    fig.setAttribute("role", "img");
    const seg = mk("div", "dress-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Pose");
    const poseBtns = [["idle", "Standing"], ["cheer", "Winner"]].map(([key, label]) => {
      const b = btn(label, null, () => { pose = key; draw(); });
      b.dataset.pose = key;
      return b;
    });
    seg.append(...poseBtns);
    const detail = mk("div", "pshop-detail");
    detail.setAttribute("aria-live", "polite");
    const hint = mk("p", "pshop-hint", "Tap an item to try it on.");
    if (inApp) {
      const ctl = mk("div", "dress-stage-ctl");
      ctl.append(seg);
      stage.append(fig, mk("div", "dress-pedestal"), ctl, hint);
    } else stage.append(fig, mk("div", "dress-pedestal pshop-pedestal"), seg, detail);

    const tabs = mk("div", "dress-tabs pshop-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Categories");
    const tabBtns = SHOP_TABS.map(([key, label]) => {
      const b = btn(label, "dress-tab", () => { if (tab !== key) jump = true; tab = key; pick = null; draw(); });
      if (inApp) iconTab(b, key, label);
      b.id = "pshop-tab-" + key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "pshop-grid");
      return b;
    });
    tabs.append(...tabBtns);
    tabs.onkeydown = e => {
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
      e.preventDefault();
      const i = SHOP_TABS.findIndex(([k]) => k === tab), d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      tab = SHOP_TABS[(i + d + SHOP_TABS.length) % SHOP_TABS.length][0];
      pick = null;
      jump = true;
      draw();
      tabBtns.find(b => b.id === "pshop-tab-" + tab).focus();
    };
    const grid = mk("div", inApp ? "dress-grid" : "dress-tiles pshop-grid");
    grid.id = "pshop-grid";
    grid.setAttribute("role", "tabpanel");

    const body = mk("div", "dress-body");
    // App only: the picked piece's name, price and Buy / Equip, pinned under the grid
    const bar = mk("div", "dress-actions pshop-bar");
    let pager = null;
    if (inApp) {
      wrap.classList.add("dress-v3");
      crabbyHideable(guide, top, coins.badge, crabbyLines);
      pager = dressPager(grid, () => draw());
      wrap.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
      bar.append(detail);
      body.append(guide, coins.note, tabs, stage, grid, pager.el);
      wrap.append(top, body, bar);
    } else {
      const shelf = mk("div", "pshop-shelf");
      shelf.append(tabs, grid);
      const layout = mk("div", "pshop-layout");
      layout.append(stage, shelf);
      body.append(guide, coins.note, layout);
      const scroller = mk("div", "dress-scroll");
      scroller.append(body);
      wrap.append(top, scroller);
    }

    const stock = () => shopSorted(OUTFIT_SLOTS[tab]).filter(it => it.rarity !== "bogey");
    const wearing = () => pick ? { ...base, [OUTFIT_PIECES[pick].slot]: pick } : base;
    function drawDetail() {
      detail.replaceChildren();
      if (inApp) { bar.hidden = !pick; hint.hidden = !!pick; }
      if (!pick) { if (!inApp) detail.append(hint); return; }
      const it = OUTFIT_PIECES[pick].piece, row = SHOP.prices[pick];
      const head = mk("div", "pshop-name");
      head.append(mk("b", null, it.name), mk("span", "dress-rarity r-" + it.rarity, RARITY_NAME[it.rarity]));
      detail.append(head);
      if (outfitOwned(pick)) {
        detail.append(mk("span", "dress-owned", "Owned"), btn("Equip it", "pshop-equip", () => finish(pick)));
        return;
      }
      if (!SHOP.ready || !row || !row.active) { detail.append(mk("p", "pshop-hint", SHOP.ready ? "Not for sale right now." : "The register's down. Try again soon.")); return; }
      // The price shows on its own when there's no Buy button carrying it
      const price = mk("span", "pshop-price");
      price.innerHTML = COIN_SVG + "<b>" + row.price + "</b>";
      price.setAttribute("aria-label", coinsText(row.price));
      if (!SHOP.signedIn) { detail.append(price, btn("Create account to buy", "", () => buyPiece(pick).then(refresh))); return; }
      if (SHOP.balance < row.price) {
        detail.append(price, mk("p", "pshop-hint", needText(row.price - SHOP.balance)), btn("Get coins", "btn-ghost", () => guide.say(CRABBY_SHOP.getCoins)));
        return;
      }
      const buy = btn("", "pshop-buy", async () => {
        buy.disabled = true;
        const id = pick;
        if (await buyPiece(id)) guide.say(CRABBY_SHOP.bought[Math.floor(Math.random() * CRABBY_SHOP.bought.length)]);
        refresh();
        const eq = detail.querySelector(".pshop-equip");
        if (eq) eq.focus();
      });
      buy.innerHTML = "Buy for " + COIN_SVG + "<b>" + row.price + "</b>";
      buy.setAttribute("aria-label", "Buy the " + it.name + " for " + coinsText(row.price));
      detail.append(buy);
    }
    function draw() {
      fig.innerHTML = PX.svg(wearing(), pose);
      fig.setAttribute("aria-label", pick ? "Your character wearing the " + OUTFIT_PIECES[pick].piece.name : "Your character");
      poseBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.pose === pose)));
      tabBtns.forEach((b, i) => {
        const on = SHOP_TABS[i][0] === tab;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
      });
      grid.setAttribute("aria-labelledby", "pshop-tab-" + tab);
      const list = stock();
      const shown = inApp ? pager.slice(list, jump ? list.findIndex(it => it.id === pick) : null) : list;
      jump = false;
      const tiles = shown.map(it => {
        const b = mk("button", "dress-tile shop-piece r-" + it.rarity + (pick === it.id ? " selected" : "") + (outfitOwned(it.id) ? "" : " locked"));
        b.type = "button";
        b.setAttribute("aria-pressed", String(pick === it.id));
        b.setAttribute("aria-label", pieceLabel(it));
        const s = mk("span", "dress-px");
        s.innerHTML = PX.svg({ ...base, [tab]: it.id }, "idle");
        b.append(s, tileText(mk, mk("span", "dress-tile-name", it.name), mk("span", "dress-rarity r-" + it.rarity, RARITY_NAME[it.rarity]), pieceTag(it, mk)));
        b.onclick = () => {
          pick = it.id;
          const row = SHOP.prices[it.id];
          if (outfitOwned(it.id)) guide.say(CRABBY_SHOP.owned);
          else if (SHOP.signedIn && row && SHOP.balance < row.price) guide.say(CRABBY_SHOP.short);
          else guide.say(CRABBY_SHOP.browse[Math.floor(Math.random() * CRABBY_SHOP.browse.length)]);
          draw();
        };
        return b;
      });
      if (inApp) {
        const row = mk("div", "dress-tiles");
        if (pager.count > 1) row.setAttribute("aria-label", "Page " + (pager.page + 1) + " of " + pager.count);
        row.append(...tiles);
        grid.replaceChildren(row);
      } else grid.replaceChildren(...tiles);
      drawDetail();
    }
    function refresh() { coins.update(); draw(); }

    const finish = equip => {
      wrap.remove();
      document.removeEventListener("keydown", onKey);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      resolve(equip);
    };
    const onKey = e => { if (e.key === "Escape" && !document.querySelector(".pshop ~ .modal")) finish(null); };
    document.addEventListener("keydown", onKey);
    document.body.append(wrap);
    draw();
    setTimeout(() => back.focus({ preventScroll: true }), 50);
  });
}

// ---------- Home profile menu (top right) ----------
(function profileMenu() {
  if (new URLSearchParams(location.search).get("r")) return;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = mk("button", "profile-home home-only");
  btn.type = "button";
  btn.setAttribute("aria-label", "Profile and settings");
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  const menu = mk("div", "profile-menu");
  menu.hidden = true;
  document.body.append(btn, menu);

  const swRow = (label, get, set) => {
    const r = mk("div", "pm-row");
    const b = mk("button", "switch");
    b.type = "button";
    b.setAttribute("role", "switch");
    b.setAttribute("aria-label", label);
    const sync = () => { const on = get(); b.classList.toggle("on", on); b.textContent = on ? "On" : "Off"; b.setAttribute("aria-checked", String(on)); };
    b.onclick = (e) => { e.stopPropagation(); set(!get()); sync(); };
    sync();
    r.append(mk("span", null, label), b);
    return r;
  };
  const linkRow = (label, fn) => {
    const b = mk("button", "pm-link", label);
    b.type = "button";
    b.onclick = async (e) => { e.stopPropagation(); close(); await fn(); renderAccount(); };
    return b;
  };
  async function draw() {
    menu.innerHTML = "";
    const { data: { session } } = await db.auth.getSession();
    const u = session && session.user;
    const signed = !!(u && !u.is_anonymous);
    const md = (u && u.user_metadata) || {};
    await loadClub();
    const head = mk("div", "pm-head", signed ? (md.first_name || u.email) : "Playing as a guest");
    if (tier() === "club") head.append(clubBadge());
    menu.append(head);
    menu.append(
      swRow("Sound effects", () => Sound.sfxOn, v => { Sound.setSfx(v); if (v) Sound.play("pop"); }),
      swRow("Music", () => Sound.musicOn, v => Sound.setMusic(v)),
      swRow("Light mode", () => isLight(), v => setThemePref(v ? "light" : "dark")));
    menu.append(mk("div", "pm-sep"));
    const club = mk("button", "pm-link pm-club", tier() === "club" ? "Club membership" : "Become a Club Member");
    club.type = "button";
    club.onclick = () => (location.href = "/club");
    menu.append(club);
    if (signed) menu.append(linkRow("Edit profile", openProfile), linkRow("Sign out", signOut));
    else menu.append(linkRow("Create account", createAccount), linkRow("Sign in", signIn));
    const legal = mk("div", "pm-legal");
    legal.innerHTML = '<a href="/terms.html">Terms</a><a href="/privacy.html">Privacy</a>';
    menu.append(mk("div", "pm-sep"), legal);
  }
  function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  btn.onclick = async (e) => {
    e.stopPropagation();
    if (!menu.hidden) return close();
    await draw();
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  };
  menu.onclick = e => e.stopPropagation();
  document.addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();

// ---------- App only: Crabby and your character behind the Pro Shop counter on home ----------
// Rotating one-liners (no grumble sound, so home stays quiet). Tapping it opens the dressing room.
const HOME_DESK_LINES = [
  "Who let this one behind the counter?",
  "Nice outfit. Did your mom pick it out?",
  "Tap Play Now. The course isn't gonna embarrass itself.",
  "I've seen better swings on a screen door.",
  "Stand up straight. You're scaring the customers.",
  "New gear's in the Pro Shop. Your coins aren't doing anything.",
  "Losers buy the first round. Just saying.",
  "You've got the look of a 30 handicap. I mean that nicely.",
];
(function homeDesk() {
  if (!document.documentElement.classList.contains("in-app")) return;
  if (new URLSearchParams(location.search).get("r")) return;
  let i = Math.floor(Math.random() * HOME_DESK_LINES.length);
  const desk = crabbyDesk(HOME_DESK_LINES[i]);
  desk.classList.add("home-desk", "home-only");
  desk.setAttribute("role", "button");
  desk.setAttribute("tabindex", "0");
  desk.setAttribute("aria-label", "Your character with Crabby. Tap to customize.");
  // Crabby stays behind his standard counter; your character stands beside it
  const stage = desk.querySelector(".cd-stage");
  const row = document.createElement("div");
  row.className = "home-desk-row";
  const me = document.createElement("div");
  me.className = "home-desk-me";
  stage.replaceWith(row);
  row.append(stage, me);
  const drawMe = async () => { try { me.innerHTML = PX.svg(await myOutfit(), "idle"); } catch (e) { me.innerHTML = PX.svg(DEFAULT_OUTFIT, "idle"); } };
  drawMe();
  window.addEventListener("outfit-changed", drawMe);
  const open = () => $("char-btn").click();
  desk.onclick = open;
  desk.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
  document.querySelector("svg.course").before(desk);
})();

// ---------- App only: bottom bar with Customize Character, profile and Recent rounds ----------
// The labels match HOME_GATED, so gateHomeButtons locks them for guests like the old home buttons.
(function appNav() {
  if (!document.documentElement.classList.contains("in-app")) return;
  if (new URLSearchParams(location.search).get("r")) return;
  const prof = document.querySelector(".profile-home");
  const item = (label, icon, target) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "app-nav-btn";
    b.setAttribute("aria-label", label === "Character" ? "Customize character" : "Recent rounds");
    b.innerHTML = icon + "<span>" + label + "</span>";
    b.onclick = () => $(target).click();
    return b;
  };
  const SHIRT = '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/></svg>';
  const CLOCK = '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const nav = document.createElement("nav");
  nav.className = "app-nav home-only";
  nav.setAttribute("aria-label", "Home");
  nav.append(item("Character", SHIRT, "char-btn"), prof, item("Rounds", CLOCK, "recent-btn"));
  document.body.append(nav);
})();

// ---------- modal-x: close buttons, no accidental closes, no address autofill ----------
(function popupHelpers() {
  const KEEP_AUTOFILL = new Set(["email", "password"]);
  const noAutofill = root => root.querySelectorAll("input, textarea").forEach(i => {
    if (KEEP_AUTOFILL.has(i.type) || i.hasAttribute("data-autofill-ok")) return;
    const a = i.getAttribute("autocomplete");
    if (a && a !== "on" && a !== "off") return;
    i.setAttribute("autocomplete", "off");
    i.setAttribute("data-lpignore", "true");
    i.setAttribute("data-1p-ignore", "true");
    if (!i.name) i.name = "pc-" + Math.random().toString(36).slice(2, 8);
  });
  const addX = modal => {
    const panel = modal.querySelector(".modal-panel");
    if (!panel || panel.querySelector(":scope > .modal-x")) return;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "modal-x";
    x.setAttribute("aria-label", "Close");
    x.textContent = "\u2715";
    x.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const btns = [...panel.querySelectorAll("button")].filter(b => b !== x);
      const out = btns.find(b => /^(cancel|back|done|close|not now|skip)$/i.test(b.textContent.trim()));
      if (out) { out.click(); return; }
      modal.__xclose = true;
      modal.click();
      if (modal.isConnected) modal.remove();
    };
    panel.prepend(x);
  };
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    noAutofill(n);
    if (n.classList.contains("modal")) addX(n);
    n.querySelectorAll && n.querySelectorAll(".modal").forEach(addX);
  }))).observe(document.body, { childList: true, subtree: true });
  noAutofill(document);
  // Clicking the dim background doesn't close popups that have boxes to fill in
  document.addEventListener("click", e => {
    const m = e.target;
    if (!m.classList || !m.classList.contains("modal") || m.__xclose) return;
    if (m.querySelector("input, select, textarea")) { e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
})();

// no-wheel-numbers: scrolling over a number box scrolls the page instead of changing the number
document.addEventListener("wheel", e => {
  const t = e.target;
  if (t && t.tagName === "INPUT" && t.type === "number" && document.activeElement === t) t.blur();
}, { passive: true, capture: true });

// ---------- Home: Play Now + Customize Character ----------
(function homeButtons() {
  const play = document.getElementById("play-now"), ch = document.getElementById("char-btn");
  if (play) play.onclick = async () => {
    const pick = await pickFrom("Let's play", [
      { label: "Start a new round", value: "create-round" },
      { label: "Join with a code", value: "join-code" },
      { label: "Play Mini-golf", value: "create-mini" }
    ]);
    if (pick) document.getElementById(pick).click();
  };
  if (ch) ch.onclick = () => openDressingRoom().then(() => window.dispatchEvent(new Event("outfit-changed")));
})();

// ---------- Coin menu ----------
function coinMenu(anchor) {
  document.querySelectorAll(".coin-menu").forEach(m => m.remove());
  const r = anchor.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "coin-menu";
  menu.style.top = Math.round(r.bottom + 6) + "px";
  menu.style.right = Math.max(10, Math.round(innerWidth - r.right)) + "px";
  const item = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pm-link"; b.textContent = label;
    b.onclick = e => { e.stopPropagation(); menu.remove(); fn(); };
    return b;
  };
  menu.append(item("Buy coins", buyCoinsScreen), item("How to earn", howToEarn));
  document.body.append(menu);
  const off = e => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", off, true); } };
  setTimeout(() => document.addEventListener("click", off, true), 0);
}

function coinModal(title) {
  const wrap = document.createElement("div");
  wrap.className = "modal coin-modal";
  const panel = document.createElement("div");
  panel.className = "modal-panel";
  const h = document.createElement("h2");
  h.textContent = title;
  panel.append(h);
  const done = document.createElement("button");
  done.type = "button"; done.textContent = "Done";
  done.style.cssText = "width:100%;margin-top:16px";
  done.onclick = () => wrap.remove();
  wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
  wrap.append(panel);
  return { wrap, panel, done };
}

function buyCoinsScreen() {
  const { wrap, panel, done } = coinModal("Buy coins");
  const bal = document.createElement("p");
  bal.className = "waiting";
  bal.innerHTML = "You have " + COIN_SVG + " <b>" + (SHOP.signedIn ? SHOP.balance : 0) + "</b>";
  const grid = document.createElement("div");
  grid.className = "coin-bundles";
  [[10, 1, 0, ""], [55, 5, 5, ""], [120, 10, 20, "Best value"]].forEach(([n, usd, bonus, tag]) => {
    const card = document.createElement("div");
    card.className = "coin-bundle" + (tag ? " best" : "");
    card.innerHTML = (tag ? '<span class="cb-tag">' + tag + "</span>" : "") +
      '<div class="cb-coins">' + COIN_SVG.replace('width="16" height="16"', 'width="34" height="34"') + "<b>" + n + "</b></div>" +
      '<div class="cb-sub">' + (bonus ? "Includes " + bonus + " bonus" : "coins") + "</div>";
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "$" + usd;
    b.onclick = () => toast("Coming soon. Payments aren't set up yet.");
    card.append(b);
    grid.append(card);
  });
  const note = document.createElement("p");
  note.className = "coin-note";
  note.textContent = SHOP.signedIn ? "Coins are spent in the Pro Shop on new gear for your character." : "Create an account to earn and spend coins.";
  panel.append(bal, grid, note, done);
  document.body.append(wrap);
}

function howToEarn() {
  const { wrap, panel, done } = coinModal("How to earn coins");
  const list = document.createElement("div");
  list.className = "coin-ways";
  [["Play a round", "Finish all 18 holes while signed in and get 1 coin. Max 1 coin a day from rounds."],
   ["Try a new game mode", "The first time you finish a round of each game mode (except Stroke Play), get a 10 coin bonus on top. Every other mode comes with the Club."],
   ["Buy coins", "Grab a coin bundle any time from Buy coins."]].forEach(([t, d]) => {
    const row = document.createElement("div");
    row.className = "coin-way";
    row.innerHTML = COIN_SVG.replace('width="16" height="16"', 'width="26" height="26"');
    const txt = document.createElement("div");
    const b = document.createElement("b"); b.textContent = t;
    const p = document.createElement("p"); p.textContent = d;
    txt.append(b, p);
    row.append(txt);
    list.append(row);
  });
  const left = document.createElement("p");
  left.className = "coin-note";
  left.textContent = SHOP.signedIn ? "Checking which bonuses you have left..." : "Sign in to earn coins.";
  if (SHOP.signedIn) db.from("coin_ledger").select("reason").like("reason", "First time playing %").then(({ data }) => {
    const done = new Set((data || []).map(r => r.reason.replace("First time playing ", "")));
    const todo = Object.keys(MODES).filter(k => k !== "stroke" && !done.has(k)).map(k => MODES[k].name);
    left.textContent = todo.length ? "Bonuses left: " + todo.join(", ") + "." : "You've collected every game mode bonus. Legend.";
  });
  list.append(left);
  const buy = document.createElement("button");
  buy.type = "button"; buy.className = "btn-ghost"; buy.textContent = "Buy coins";
  buy.style.cssText = "width:100%;margin-top:12px";
  buy.onclick = () => { wrap.remove(); buyCoinsScreen(); };
  panel.append(list, buy, done);
  document.body.append(wrap);
}

// Guests tapped something that needs an account
async function needAccount(what) {
  const pick = await pickFrom("Create a free account to use " + what, [
    { label: "Create account", value: "create" },
    { label: "Sign in", value: "signin" }
  ]);
  if (pick === "create") await createAccount();
  if (pick === "signin" && await signIn()) location.reload();
}
