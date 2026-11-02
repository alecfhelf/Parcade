// ---------- App load-up animation ----------
// The PARCADE sign drops in, the P falls on a stick golfer's head, he gets up, rubs his head, shakes his fist at the
// sign and gets knocked out by a golf ball. App only (html.in-app), once per app launch, tap anywhere or Skip to skip.
// Loaded right after <body> so the overlay covers the page before it paints.
(function loadup() {
  const root = document.documentElement;
  if (!root.classList.contains("in-app")) return;
  try { if (sessionStorage.getItem("parcade-loadup")) return; sessionStorage.setItem("parcade-loadup", "1"); } catch (e) {}
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const NS = "http://www.w3.org/2000/svg";
  const W = 360, H = 640, G = 470;            // viewBox and ground line
  const C = "#5CE1FF", P_C = "#EAF6FF", BALL = "#FFFFFF", HOT = "#FF5C7A", GOLD = "#FFD84D";
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.append(e); return e; };

  const ov = document.createElement("div");
  ov.id = "loadup";
  ov.setAttribute("role", "img");
  ov.setAttribute("aria-label", "Parcade");
  ov.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:radial-gradient(ellipse 90% 55% at 50% 78%,rgba(46,107,255,0.28),transparent 70%),#050817;" +
    "display:flex;align-items:center;justify-content:center;transition:opacity .45s ease;touch-action:none;";
  const svg = mk("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid meet", width: "100%", height: "100%" });
  svg.style.cssText = "max-width:520px;overflow:visible;";
  ov.append(svg);
  const skip = document.createElement("button");
  skip.type = "button";
  skip.textContent = "Skip";
  skip.style.cssText = "position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));" +
    "background:none;border:none;color:#5CE1FF;font:600 16px 'Chakra Petch',system-ui,sans-serif;text-decoration:underline;padding:10px;clip-path:none;";
  ov.append(skip);
  (document.body || root).append(ov);

  // Floor: glowing ground line and a perspective grid
  const defs = mk("defs", {}, svg);
  const glow = mk("filter", { id: "lu-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
  mk("feGaussianBlur", { stdDeviation: "2.2", result: "b" }, glow);
  const merge = mk("feMerge", {}, glow);
  mk("feMergeNode", { in: "b" }, merge); mk("feMergeNode", { in: "SourceGraphic" }, merge);
  const floor = mk("g", { stroke: C, "stroke-opacity": "0.16", "stroke-width": "1" }, svg);
  for (let i = 1; i <= 7; i++) { const y = G + i * i * 3.4; mk("line", { x1: -200, y1: y, x2: W + 200, y2: y }, floor); }
  for (let i = -8; i <= 8; i++) mk("line", { x1: W / 2 + i * 28, y1: G, x2: W / 2 + i * 130, y2: H + 60 }, floor);
  mk("line", { x1: -40, y1: G, x2: W + 40, y2: G, stroke: C, "stroke-opacity": "0.55", "stroke-width": "2", filter: "url(#lu-glow)" }, svg);

  // Sign letters
  const sign = mk("g", { filter: "url(#lu-glow)" }, svg);
  const LETTERS = "PARCADE".split("");
  const FS = 50, BASE = 196;
  const letters = LETTERS.map(ch => {
    const t = mk("text", { x: 0, y: BASE, "font-family": "Bungee, Impact, sans-serif", "font-size": FS, fill: P_C, stroke: P_C, "stroke-width": "1", "text-anchor": "start" }, sign);
    t.textContent = ch;
    return t;
  });

  // The golfer
  const guy = mk("g", { stroke: C, "stroke-width": "4.5", "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none", filter: "url(#lu-glow)" }, svg);
  const body = mk("path", {}, guy);
  const head = mk("circle", { r: "12", fill: "#050817" }, guy);
  const eyes = mk("g", { stroke: C, "stroke-width": "2.4" }, guy);
  // Fallen P, stars, ball, words
  const pFall = mk("text", { "font-family": "Bungee, Impact, sans-serif", "font-size": FS, fill: P_C, stroke: P_C, "stroke-width": "1", filter: "url(#lu-glow)", opacity: "0" }, svg);
  pFall.textContent = "P";
  const stars = mk("g", { fill: GOLD, opacity: "0" }, svg);
  const STAR = "M0-5L1.5-1.5L5 0L1.5 1.5L0 5L-1.5 1.5L-5 0L-1.5-1.5Z";
  const starEls = [0, 1, 2].map(() => mk("path", { d: STAR }, stars));
  const ball = mk("circle", { r: "5", fill: BALL, filter: "url(#lu-glow)", opacity: "0" }, svg);
  const word = (txt, color, size) => { const t = mk("text", { "font-family": "Bungee, Impact, sans-serif", "font-size": size, fill: color, "text-anchor": "middle", opacity: "0" }, svg); t.textContent = txt; return t; };
  const bonk = word("BONK!", GOLD, 22), curse = word("#@%!", HOT, 18), whack = word("THWACK!", GOLD, 22);

  // ---------- Skeleton ----------
  // Angles in degrees: 0 points straight down, positive swings toward +x (the way he faces).
  // Arms hang from the shoulder, legs from the hip; each limb is [upper, lower bend]. rot turns the whole figure around the hip.
  const L = { torso: 44, neck: 15, upper: 21, fore: 20, thigh: 27, shin: 27 };
  const rad = d => d * Math.PI / 180;
  const at = (p, len, a) => [p[0] + len * Math.sin(rad(a)), p[1] + len * Math.cos(rad(a))];
  function draw(s) {
    const hip = [s.x, s.y];
    const sh = [hip[0] + L.torso * Math.sin(rad(s.lean)), hip[1] - L.torso * Math.cos(rad(s.lean))];
    const hc = [sh[0] + L.neck * Math.sin(rad(s.lean + s.head)), sh[1] - L.neck * Math.cos(rad(s.lean + s.head))];
    const limb = (base, a, b, l1, l2) => { const j = at(base, l1, a); const e = at(j, l2, a + b); return "M" + base + "L" + j + "L" + e; };
    const neckTop = [sh[0] + 3 * Math.sin(rad(s.lean + s.head)), sh[1] - 3 * Math.cos(rad(s.lean + s.head))];
    body.setAttribute("d", "M" + hip + "L" + neckTop +
      limb(hip, s.ll[0], s.ll[1], L.thigh, L.shin) + limb(hip, s.rl[0], s.rl[1], L.thigh, L.shin) +
      limb(sh, s.lean + s.la[0], s.la[1], L.upper, L.fore) + limb(sh, s.lean + s.ra[0], s.ra[1], L.upper, L.fore));
    head.setAttribute("cx", hc[0]); head.setAttribute("cy", hc[1]);
    guy.setAttribute("transform", "rotate(" + s.rot + " " + hip[0] + " " + hip[1] + ")");
    // Eyes: dots normally, X's when knocked out
    eyes.innerHTML = "";
    const fx = Math.sin(rad(s.lean + s.head + 90)), fy = -Math.cos(rad(s.lean + s.head + 90));
    const ex = hc[0] + fx * 4, ey = hc[1] + fy * 4 - 2;
    if (s.ko) {
      [[-3, 0], [3, 0]].forEach(([dx]) => {
        const cx = ex + dx * 0.6 - 1, cy = ey + dx * 0.9;
        mk("path", { d: "M" + (cx - 2) + " " + (cy - 2) + "L" + (cx + 2) + " " + (cy + 2) + "M" + (cx + 2) + " " + (cy - 2) + "L" + (cx - 2) + " " + (cy + 2) }, eyes);
      });
    } else {
      mk("path", { d: "M" + (ex - 1) + " " + (ey - 1) + "l0.1 0M" + (ex + 4) + " " + (ey - 1) + "l0.1 0", "stroke-width": "3" }, eyes);
    }
    return { hip, sh, hc };
  }
  // Head position for a pose, in screen space (after the figure's rotation)
  function headPos(s) {
    const sh = [s.x + L.torso * Math.sin(rad(s.lean)), s.y - L.torso * Math.cos(rad(s.lean))];
    const hc = [sh[0] + L.neck * Math.sin(rad(s.lean + s.head)), sh[1] - L.neck * Math.cos(rad(s.lean + s.head))];
    const r = rad(s.rot), dx = hc[0] - s.x, dy = hc[1] - s.y;
    return [s.x + dx * Math.cos(r) - dy * Math.sin(r), s.y + dx * Math.sin(r) + dy * Math.cos(r)];
  }

  // ---------- Poses ----------
  const HX = 72;                                  // where he stands, under the P
  const STAND = { x: HX, y: G - 54, rot: 0, lean: 0, head: 0, la: [-8, 10], ra: [8, 14], ll: [-6, 0], rl: [7, 0] };
  const pose = (o) => Object.assign({}, STAND, o);
  const KEYS = [
    // fall from the P
    [2.18, pose({ head: -12, lean: -4, la: [-12, 12], ra: [14, 16] })],
    [2.30, pose({ y: G - 44, lean: 6, head: 18, la: [140, 30], ra: [160, 20], ll: [26, -52], rl: [32, -60] })],
    [2.48, pose({ y: G - 34, rot: 40, lean: 4, head: 10, la: [120, 20], ra: [170, 10], ll: [-10, -30], rl: [-20, -20] })],
    [2.70, pose({ y: G - 7, rot: 88, head: -4, la: [150, 10], ra: [170, 20], ll: [-4, 0], rl: [-12, 6] })],
    [2.82, pose({ y: G - 9, rot: 90, head: 0, la: [160, 10], ra: [175, 10], ll: [-2, 0], rl: [-10, 4] })],
    // dazed on the ground, face down
    [3.45, pose({ y: G - 9, rot: 90, head: 0, la: [160, 10], ra: [175, 10], ll: [-2, 0], rl: [-10, 4] })],
    // push up onto hands and knees
    [3.78, pose({ y: G - 26, rot: 55, lean: 0, head: -25, la: [95, -55], ra: [100, -50], ll: [-30, -70], rl: [-15, -85] })],
    // kneel
    [4.05, pose({ y: G - 34, rot: 0, lean: 22, head: 4, la: [-10, 30], ra: [30, 40], ll: [70, -98], rl: [-6, -78] })],
    // stand
    [4.30, pose({ head: -4 })],
  ];
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const mix = (a, b, k) => {
    const o = {};
    for (const key in a) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => v + (b[key][i] - v) * k) : typeof a[key] === "number" ? a[key] + (b[key] - a[key]) * k : b[key];
    return o;
  };
  function keyed(t) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const [t0, p0] = KEYS[i], [t1, p1] = KEYS[i + 1];
      if (t >= t0 && t <= t1) return mix(p0, p1, ease((t - t0) / (t1 - t0)));
    }
    return KEYS[KEYS.length - 1][1];
  }

  function guyAt(t) {
    // 1. walk in
    if (t < 1.15) {
      const k = Math.min(1, t / 1.15), x = -40 + (HX + 40) * (1 - Math.pow(1 - k, 2));
      const ph = t * Math.PI * 2 * 2.1, amp = 1 - Math.pow(k, 6);
      const sw = Math.sin(ph) * 26 * amp;
      return pose({ x, y: G - 54 - Math.abs(Math.cos(ph)) * 2.5 * amp, lean: 5 * amp,
        ll: [sw, -Math.max(0, Math.sin(ph + 1.2)) * 46 * amp], rl: [-sw, -Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * 46 * amp],
        la: [-sw * 0.9, 18], ra: [sw * 0.9, 22] });
    }
    // 2. idle, then look up at the sign
    if (t < 2.18) {
      const up = Math.min(1, Math.max(0, (t - 1.45) / 0.35));
      return pose({ y: G - 54 + Math.sin(t * 5) * 0.6, head: -16 * up, lean: -5 * up, la: [-12, 12 + Math.sin(t * 5) * 2], ra: [14, 16] });
    }
    // 3-5. fall, dazed, get up
    if (t < 4.3) return keyed(t);
    // 6. rub the head
    if (t < 5.05) {
      const k = Math.min(1, (t - 4.3) / 0.2);
      return pose({ head: 10 * k, lean: 4 * k, ra: [8 + 150 * k, 14 + (112 + Math.sin(t * 22) * 16) * k], la: [-10, 14] });
    }
    // 7. shake a fist at the sign
    if (t < 5.75) {
      const k = Math.min(1, (t - 5.05) / 0.15), sh = Math.sin(t * 38) * 10 * k;
      return pose({ head: -22 * k, lean: -8 * k, ra: [158 * k + 8 + sh, 30 * k + sh * 0.6], la: [-20 - 20 * k, 40 + 70 * k], ll: [-10, 0], rl: [10, 0] });
    }
    // 8. hit by the ball: flies back and lands flat, knocked out
    const k = Math.min(1, (t - 5.75) / 0.45), e = 1 - Math.pow(1 - k, 2);
    const hop = Math.sin(Math.PI * Math.min(1, k * 1.1)) * 26;
    return pose({ x: HX + 40 * e, y: G - 54 + (47 * e) - hop, rot: 92 * e, lean: -6 * (1 - e), head: -10 * e,
      la: [-20 + 180 * e, 20], ra: [20 + 150 * e, 30], ll: [-6 - 20 * e, 10 * e], rl: [7 - 30 * e, 6 * e], ko: k > 0.4 });
  }

  // ---------- Run ----------
  let layout = null, t0 = 0, raf = 0, done = false;
  function measure() {
    const widths = letters.map(l => { try { return l.getComputedTextLength(); } catch (e) { return FS * 0.8; } });
    const gap = 2, total = widths.reduce((a, b) => a + b, 0) + gap * (letters.length - 1);
    let x = (W - total) / 2;
    const xs = widths.map(w => { const v = x; x += w + gap; return v; });
    letters.forEach((l, i) => l.setAttribute("x", xs[i]));
    return { xs, widths };
  }
  function frame(now) {
    if (done) return;
    const t = (now - t0) / 1000;

    // Sign: letters drop in one by one with a bounce; the P wobbles, then falls
    letters.forEach((l, i) => {
      const s = 0.95 + i * 0.07, d = 0.5;
      let y = -80;
      if (t >= s) {
        const k = Math.min(1, (t - s) / d);
        const b = k < 0.6 ? Math.pow(k / 0.6, 2) : 1 - Math.sin((k - 0.6) / 0.4 * Math.PI) * 0.08 * (1 - k);
        y = -80 + (BASE + 80) * b - BASE;
      }
      l.setAttribute("transform", "translate(0 " + (t >= s ? y : -400) + ")");
    });
    const p = letters[0], px = layout.xs[0], pw = layout.widths[0];
    if (t > 1.62 && t < 1.95) p.setAttribute("transform", "rotate(" + (Math.sin((t - 1.62) * 40) * 9) + " " + px + " " + BASE + ")");
    const g = guyAt(t);
    const hpos = headPos(g);
    if (t >= 1.95) {
      p.setAttribute("opacity", "0");
      pFall.setAttribute("opacity", "1");
      let fx, fy, fr;
      if (t < 2.2) {                         // falls onto his head
        const k = (t - 1.95) / 0.25;
        fx = px; fy = BASE + (hpos[1] - 12 - BASE) * k * k; fr = 0;
      } else {                               // bounces off and lands tipped on the ground
        const k = Math.min(1, (t - 2.2) / 0.55), e = 1 - Math.pow(1 - k, 2);
        fx = px - 30 * e; fy = (hpos[1] - 12) + (G - (hpos[1] - 12)) * k * k - Math.sin(Math.PI * k) * 40; fr = -24 * e;
        if (k >= 1) { fx = px - 30; fy = G; fr = -24; }
      }
      pFall.setAttribute("x", fx);
      pFall.setAttribute("y", fy);
      pFall.setAttribute("transform", "rotate(" + fr + " " + (fx + pw / 2) + " " + fy + ")");
    }

    draw(g);

    // Dizzy stars after each hit
    const dizzy = (t > 2.3 && t < 3.6) || t > 6.15;
    stars.setAttribute("opacity", dizzy ? "1" : "0");
    if (dizzy) starEls.forEach((st, i) => {
      const a = t * 6 + i * 2.1;
      st.setAttribute("transform", "translate(" + (hpos[0] + Math.cos(a) * 16) + " " + (hpos[1] - 14 + Math.sin(a) * 5) + ")");
    });
    const show = (el, a, b, x, y) => { el.setAttribute("opacity", t > a && t < b ? "1" : "0"); el.setAttribute("x", x); el.setAttribute("y", y); };
    show(bonk, 2.2, 2.75, hpos[0] + 30, hpos[1] - 30);
    show(curse, 5.15, 5.75, hpos[0] + 34, hpos[1] - 34);
    show(whack, 5.75, 6.3, hpos[0], hpos[1] - 34);

    // The ball: flies in from the right and bounces away off his head
    if (t > 5.4 && t < 6.6) {
      ball.setAttribute("opacity", "1");
      let bx, by;
      if (t < 5.75) {
        const k = (t - 5.4) / 0.35;
        bx = -30 + (hpos[0] - 10 + 30) * k; by = G - 190 + (hpos[1] - (G - 190)) * k - Math.sin(Math.PI * k) * 40;
      } else {
        const k = (t - 5.75) / 0.85;
        bx = hpos[0] - 10 - 150 * k; by = hpos[1] - 120 * k + 260 * k * k;
      }
      ball.setAttribute("cx", bx); ball.setAttribute("cy", by);
    } else ball.setAttribute("opacity", "0");

    if (t > 6.9) return finish();
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    ov.style.opacity = "0";
    setTimeout(() => ov.remove(), 480);
  }
  skip.onclick = finish;
  ov.addEventListener("click", e => { if (e.target !== skip) finish(); });

  const start = () => { if (done) return; layout = measure(); t0 = performance.now(); raf = requestAnimationFrame(frame); };
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load(FS + "px Bungee") : Promise.resolve();
  Promise.race([fontReady, new Promise(r => setTimeout(r, 3000))]).then(() => requestAnimationFrame(start));
  // Never block the app: the overlay always goes away
  setTimeout(finish, 9000);
  // Testing hook: window.__loadupSeek(t) draws a single frame
  window.__loadupSeek = sec => { if (!layout) layout = measure(); done = false; t0 = performance.now() - sec * 1000; cancelAnimationFrame(raf); frame(performance.now()); cancelAnimationFrame(raf); };
})();
