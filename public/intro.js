// ---------- Hole intro reveal ----------
function walkerSVG() {
  return '<span class="crabby">' + crabbySVG(72) + '</span>';
}

function stickSVG() {
  return '<svg viewBox="0 0 40 60" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="20" cy="8" r="6"/><path d="M20 14V34"/>' +
    '<path class="arms-pull" d="M20 20L4 26M20 20L30 27"/>' +
    '<path class="arms-up" d="M20 20L11 3M20 20L29 3"/>' +
    '<g class="leg-a"><path d="M20 34L13 58"/></g><g class="leg-b"><path d="M20 34L27 58"/></g></svg>';
}

function wheelSVG(items) {
  const n = items.length, step = 360 / n;
  let slices = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i * step - step / 2 - 90) * Math.PI / 180;
    const a1 = (i * step + step / 2 - 90) * Math.PI / 180;
    const p = (a) => (100 * Math.cos(a)).toFixed(2) + " " + (100 * Math.sin(a)).toFixed(2);
    const curse = items[i][1] < 0 || items[i][0].startsWith("CURSE");
    const fill = curse ? "#FF5C7A" : (i % 2 ? "#2E6BFF" : "#5CE1FF");
    slices += '<path d="M0 0L' + p(a0) + "A100 100 0 0 1 " + p(a1) + 'Z" fill="' + fill + '" fill-opacity="0.8" stroke="#060A1A" stroke-width="1.5"/>';
  }
  return '<svg class="intro-wheel" viewBox="-110 -110 220 220" aria-hidden="true">' +
    '<circle r="106" fill="none" stroke="#5CE1FF" stroke-width="3" style="filter:drop-shadow(0 0 6px #5CE1FF)"/>' +
    slices + '<circle r="14" fill="#060A1A" stroke="#EAF2FF" stroke-width="3"/></svg>';
}

function wolfSVG() {
  return '<svg viewBox="0 0 120 70" width="100%" height="100%" fill="none" stroke="#D6DEEE" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="overflow:visible;filter:drop-shadow(0 0 5px #9FB4FF)">' +
    '<path d="M96 30Q110 22 118 12Q116 30 100 38" fill="#0E1630"/>' +
    '<g class="wl wl-b1" style="transform-origin:86px 44px"><path d="M86 44L80 62"/></g>' +
    '<g class="wl wl-b2" style="transform-origin:90px 44px"><path d="M90 44L96 62"/></g>' +
    '<path d="M42 30Q60 18 88 24Q101 28 99 40Q86 50 54 46Q40 45 42 30Z" fill="#0E1630"/>' +
    '<g class="wl wl-f1" style="transform-origin:50px 44px"><path d="M50 44L44 62"/></g>' +
    '<g class="wl wl-f2" style="transform-origin:55px 44px"><path d="M55 44L60 62"/></g>' +
    '<path d="M46 28L36 20L32 9L28 20L21 24L9 30L7 34L18 36L30 40L44 42Z" fill="#0E1630"/>' +
    '<path d="M11 36L15 39L19 37" stroke-width="1.6"/>' +
    '<circle cx="23" cy="28" r="1.8" fill="#FF5C7A" stroke="none"/>' +
    '</svg>';
}

function golferSVG() {
  return '<svg viewBox="0 0 44 60" width="100%" height="100%" fill="none" stroke-width="3.5" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true" style="overflow:visible">' +
    '<circle cx="20" cy="8" r="6"/><path d="M20 14V34"/>' +
    '<g class="leg-a"><path d="M20 34L13 58"/></g><g class="leg-b"><path d="M20 34L27 58"/></g>' +
    '<g class="g-swing"><path d="M20 20L27 32L33 56M31 56H37"/></g>' +
    '<path d="M40 60V56" stroke-width="2" stroke="#EAF2FF"/></svg>';
}

function cartSVG(color) {
  return '<svg viewBox="0 52 50 46" width="100%" height="100%" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="overflow:visible">' +
    '<path d="M4 58H44M8 58V84M40 58V80M2 84H48V76H40M16 84V74H26" stroke="#8A9BC4" stroke-width="2.4"/>' +
    '<circle cx="10" cy="90" r="5" fill="#060A1A" stroke="#8A9BC4" stroke-width="2"/>' +
    '<circle cx="40" cy="90" r="5" fill="#060A1A" stroke="#8A9BC4" stroke-width="2"/>' +
    '<g stroke="' + color + '" stroke-width="2.4" style="filter:drop-shadow(0 0 3px ' + color + ')">' +
    '<circle cx="22" cy="64" r="4.5"/><path d="M22 68.5V78L32 80L34 88M22 71L36 75M36 72L38 78"/></g></svg>';
}

function slotSVG() {
  const bulbs = [18, 32, 46, 60, 74, 88].map(x => '<circle class="bulb" cx="' + x + '" cy="6" r="2.4" fill="#FFD84D"/>').join("");
  return '<svg viewBox="0 0 110 150" aria-hidden="true">' +
    '<rect x="8" y="2" width="84" height="30" rx="13" fill="#1B1030" stroke="#FFD84D" stroke-width="2.5"/>' + bulbs +
    '<text x="50" y="25" text-anchor="middle" font-family="Bungee, sans-serif" font-size="15" fill="#FF5C7A" style="filter:drop-shadow(0 0 3px #FF5C7A)">VEGAS</text>' +
    '<rect x="6" y="34" width="88" height="98" rx="8" fill="#0E1630" stroke="#FFD84D" stroke-width="3"/>' +
    '<rect x="13" y="48" width="74" height="38" rx="5" fill="#EAF2FF" stroke="#C9D3E8" stroke-width="2"/>' +
    '<path d="M37.7 48V86M62.3 48V86" stroke="#8A9BC4" stroke-width="1.5"/>' +
    '<path d="M11 67H89" stroke="#FF5C7A" stroke-width="1.5" opacity="0.7"/>' +
    '<text class="reel" x="25.5" y="75" text-anchor="middle" font-size="22" font-family="system-ui, sans-serif" font-weight="700" fill="#060A1A">7</text>' +
    '<text class="reel" x="50" y="75" text-anchor="middle" font-size="22" font-family="system-ui, sans-serif" font-weight="700" fill="#060A1A">7</text>' +
    '<text class="reel" x="74.5" y="75" text-anchor="middle" font-size="22" font-family="system-ui, sans-serif" font-weight="700" fill="#060A1A">7</text>' +
    '<rect x="26" y="98" width="48" height="14" rx="3" fill="#060A1A" stroke="#FFD84D" stroke-width="2"/>' +
    '<rect x="2" y="132" width="96" height="15" rx="3" fill="#1B1030" stroke="#FFD84D" stroke-width="2.5"/>' +
    '<rect x="93" y="72" width="8" height="14" rx="2" fill="#1B1030" stroke="#FFD84D" stroke-width="2"/>' +
    '<g class="lever"><path d="M97 78V40" stroke="#C9D3E8" stroke-width="4" stroke-linecap="round"/>' +
    '<circle cx="97" cy="36" r="6.5" fill="#FF5C7A" style="filter:drop-shadow(0 0 4px #FF5C7A)"/></g>' +
    '</svg>';
}

function playHoleIntro({ hole, color, challenge, idx, message, wolfGrab, coins, cartRun, bbb, carry, slots, cashRain, items = CHALLENGES }) {
  return new Promise(resolve => {
    const c = PALETTE.some(p => p[0] === color) ? color : "#5CE1FF";
    const ov = document.createElement("div");
    ov.className = "intro";
    ov.style.setProperty("--c", c);
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-label", "Hole " + hole);
    ov.innerHTML =
      '<div class="intro-shadow"></div><div class="intro-splat"></div>' +
      '<div class="intro-drag"><div class="intro-title">Hole ' + hole + '</div><div class="intro-rope"></div>' +
      '<div class="intro-walker">' + walkerSVG() + '</div></div>' +
      '<div class="intro-wheel-wrap">' + (challenge ? wheelSVG(items) : "") + '<div class="intro-pointer"></div></div>' +
      '<div class="intro-live"></div><div class="intro-result"></div>';
    const skip = document.createElement("button");
    skip.className = "link-btn intro-skip";
    skip.textContent = "Skip";
    ov.append(skip);
    document.body.append(ov);

    let done = false;
    const finish = () => { if (done) return; done = true; ov.remove(); resolve(); };
    skip.onclick = finish;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const q = (sel) => ov.querySelector(sel);
    const drag = q(".intro-drag"), title = q(".intro-title"), rope = q(".intro-rope");
    const walker = q(".intro-walker"), wsvg = walker.querySelector("svg");
    const shadow = q(".intro-shadow"), splat = q(".intro-splat");
    const wrap = q(".intro-wheel-wrap"), wheel = q(".intro-wheel"), pointer = q(".intro-pointer");
    const live = q(".intro-live"), result = q(".intro-result");
    const fadeOut = async () => { if (!done) await ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" }).finished; finish(); };
    const showResult = () => {
      if (!challenge) return;
      result.textContent = challenge.multi ? challenge.text : challenge.text + " (" + (challenge.pts > 0 ? "+" : "") + challenge.pts + ")";
      if (challenge.pts < 0 || challenge.text.startsWith("CURSE")) result.classList.add("curse");
    };

    const W = innerWidth, H = innerHeight;
    drag.style.top = (H * 0.6 - drag.offsetHeight / 2) + "px";

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drag.style.transform = "translateX(" + Math.max(12, (W - drag.offsetWidth) / 2) + "px)";
      result.style.top = "22%";
      showResult();
      if (!challenge && message) result.textContent = message;
      result.style.opacity = 1;
      sleep(2400).then(finish);
      return;
    }

    (async () => {
      // 1. Drag in: walker ends at screen center
      const dw = drag.offsetWidth;
      const walkerMid = walker.offsetLeft + walker.offsetWidth / 2;
      const endX = Math.max(12, W / 2 - walkerMid);
      Sound.play("whoosh");
      walker.classList.add("walking");
      await drag.animate([{ transform: "translateX(" + (-dw - 20) + "px)" }, { transform: "translateX(" + endX + "px)" }],
        { duration: 2200, easing: "cubic-bezier(.25,.6,.35,1)", fill: "forwards" }).finished;
      if (done) return;
      walker.classList.remove("walking");
      Sound.play("flicker");
      title.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 600 });
      await sleep(700);
      if (done) return;

      // 2. Title to top-left corner
      const tr = title.getBoundingClientRect(), sc = 0.4;
      rope.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      await title.animate([{ transform: "none" }, { transform: "translate(" + (20 + tr.width * sc / 2 - (tr.left + tr.width / 2)) + "px," +
        (24 + tr.height * sc / 2 - (tr.top + tr.height / 2)) + "px) scale(" + sc + ")" }],
        { duration: 700, easing: "ease-in-out", fill: "forwards" }).finished;
      if (done) return;
      if (!challenge) {
        if (message) {
          if (wolfGrab) {
          // Wolf runs in, grabs the walker, runs off
          const wr = walker.getBoundingClientRect();
          const wsz = Math.min(W * 0.62, Math.max(180, wr.height * 3.6));
          const wh = wsz * 70 / 120;
          const mouthX = wr.left + wr.width / 2;
          const left = mouthX - wsz * 14 / 120;
          const top = wr.bottom - wh * 62 / 70;
          const wolfEl = document.createElement("div");
          wolfEl.className = "intro-wolf run";
          Sound.play("howl");
          wolfEl.innerHTML = wolfSVG();
          Object.assign(wolfEl.style, { width: wsz + "px", height: wh + "px", left: left + "px", top: top + "px" });
          ov.append(wolfEl);
          await wolfEl.animate([{ transform: "translateX(" + (W + 40 - left) + "px)" }, { transform: "translateX(0)" }],
            { duration: 750, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }).finished;
          if (done) return;
          wolfEl.classList.remove("run");
          const mouthY = top + wh * 36 / 70;
          const dx0 = mouthX - (wr.left + wr.width / 2), dy0 = mouthY - (wr.top + wr.height * 0.1);
          walker.classList.add("holding", "walking");
          const grabbed = "translate(" + dx0 + "px," + dy0 + "px) rotate(28deg)";
          await walker.animate([{ transform: "none" }, { transform: grabbed }], { duration: 220, easing: "ease-out", fill: "forwards" }).finished;
          if (done) return;
          await sleep(300);
          if (done) return;
          wolfEl.classList.add("run");
          const out = -(left + wsz + 60);
          const exit = { duration: 900, easing: "cubic-bezier(.5,0,.8,.6)", fill: "forwards" };
          wolfEl.animate([{ transform: "translateX(0)" }, { transform: "translateX(" + out + "px)" }], exit);
          await walker.animate([{ transform: grabbed }, { transform: "translate(" + (dx0 + out) + "px," + dy0 + "px) rotate(28deg)" }], exit).finished;
          if (done) return;

          } else if (coins) {
            // Skins: three golfers tackle the flag
            const wr = walker.getBoundingClientRect();
            const fw = wr.width, fh = wr.height, ground = wr.bottom, cx = wr.left + fw / 2;
            const cols = PALETTE.filter(p => p[0] !== c).slice(0, 2).map(p => p[0]);
            const xs = [cx - fw * 1.5, cx - fw * 3];
            const figs = cols.map((col, k) => {
              const d = document.createElement("div");
              d.className = "intro-extra walking";
              d.style.setProperty("--c2", col);
              d.innerHTML = stickSVG();
              Object.assign(d.style, { width: fw + "px", height: fh + "px", left: xs[k] - fw / 2 + "px", top: ground - fh + "px" });
              ov.append(d);
              return d;
            });
            await Promise.all(figs.map((f, k) => f.animate([{ transform: "translateX(" + (-(xs[k] + fw)) + "px)" }, { transform: "none" }],
              { duration: 700 + k * 150, easing: "ease-out", fill: "forwards" }).finished));
            if (done) return;
            figs.forEach(f => f.classList.remove("walking"));

            const flagH = fh * 1.5, flagW = flagH * 40 / 90;
            const fx = Math.min(W - flagW - 16, W * 0.84 - flagW * 0.15);
            const flag = document.createElement("div");
            flag.className = "intro-flag";
            setTimeout(() => Sound.play("thud"), 520);
            flag.innerHTML = '<svg viewBox="0 0 40 90" width="100%" height="100%" aria-hidden="true" style="overflow:visible">' +
              '<ellipse cx="6" cy="88" rx="10" ry="2.5" fill="#000"/>' +
              '<path d="M6 88V6" stroke="#EAF2FF" stroke-width="3" stroke-linecap="round"/>' +
              '<path class="flag-cloth" d="M6 6L36 14L6 24Z" fill="#FF5C7A"/></svg>';
            Object.assign(flag.style, { width: flagW + "px", height: flagH + "px", left: fx + "px", top: ground - flagH + "px" });
            ov.append(flag);
            await flag.animate([{ transform: "translateY(" + (-ground) + "px)" }, { transform: "translateY(0)", offset: 0.75 },
              { transform: "translateY(-14px)", offset: 0.88 }, { transform: "translateY(0)" }],
              { duration: 700, easing: "ease-in", fill: "forwards" }).finished;
            if (done) return;
            ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-4px,3px)" }, { transform: "translate(3px,-2px)" },
              { transform: "translate(0,0)" }], { duration: 250 });
            await sleep(350);
            if (done) return;

            const poleX = fx + flagW * 6 / 40;
            const runners = [walker, ...figs];
            runners.forEach(el => el.classList.add("walking"));
            setTimeout(() => runners.forEach(el => el.classList.add("holding")), 660);
            flag.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(75deg)" }],
              { duration: 300, delay: 880, easing: "ease-in", fill: "forwards" });
            await Promise.all(runners.map((el, k) => {
              const r = el.getBoundingClientRect();
              const dx = poleX - (r.left + r.width / 2) - k * fw * 0.35 - fw * 0.2;
              return el.animate([
                { transform: "none" },
                { transform: "translateX(" + dx + "px)", offset: 0.6 },
                { transform: "translate(" + (dx + fw * 0.5) + "px," + (-fh * 0.35) + "px) rotate(60deg)", offset: 0.8 },
                { transform: "translate(" + (dx + fw * 0.8) + "px," + (fh * 0.3 - k * fh * 0.18) + "px) rotate(" + (85 + k * 8) + "deg)" }],
                { duration: 1100, easing: "linear", fill: "forwards" }).finished;
            }));
            if (done) return;
            runners.forEach(el => el.classList.remove("walking"));
            Sound.play("thud");
            ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-6px,4px)" }, { transform: "translate(5px,-3px)" },
              { transform: "translate(0,0)" }], { duration: 300 });

            const py = ground - fh * 0.35;
            for (let k = 0; k < 16; k++) {
              const coin = document.createElement("div");
              coin.className = "intro-coin";
              coin.textContent = "🪙";
              if (k % 4 === 0) setTimeout(() => Sound.play("coin"), k * 20);
              Object.assign(coin.style, { left: poleX - 10 + "px", top: py + "px" });
              ov.append(coin);
              const ex = (Math.random() - 0.5) * W * 0.5, ey = -H * (0.15 + Math.random() * 0.2);
              coin.animate([{ transform: "translate(0,0) scale(.4)", opacity: 0 },
                { transform: "translate(" + ex * 0.6 + "px," + ey + "px) scale(1)", opacity: 1, offset: 0.4 },
                { transform: "translate(" + ex + "px," + fh * 0.5 + "px) rotate(" + Math.random() * 720 + "deg)", opacity: 1 }],
                { duration: 1400, delay: k * 20, easing: "cubic-bezier(.2,.6,.5,1)", fill: "both" });
            }
            await sleep(300);
            if (done) return;
          } else if (cashRain) {
            // Wad: it's raining money and Crabby jumps for it
            const wr = walker.getBoundingClientRect();
            walker.classList.add("holding");
            for (let k = 0; k < 18; k++) {
              const bill = document.createElement("div");
              bill.className = "intro-coin";
              bill.textContent = "💵";
              bill.style.left = Math.random() * (W - 30) + "px";
              ov.append(bill);
              bill.animate([{ transform: "translateY(-40px) rotate(0deg)" },
                { transform: "translateY(" + (wr.bottom - 10) + "px) rotate(" + (Math.random() * 540 - 270) + "deg)" }],
                { duration: 1300 + Math.random() * 900, delay: Math.random() * 700, easing: "cubic-bezier(.3,0,.7,1)", fill: "both" });
              if (k % 5 === 0) setTimeout(() => Sound.play("coin"), 300 + k * 60);
            }
            walker.style.transformOrigin = "50% 100%";
            walker.animate([{ transform: "translateY(0)" }, { transform: "translateY(-18px)" }, { transform: "translateY(0)" }],
              { duration: 420, iterations: 3, easing: "ease-out" });
            await sleep(1500);
            if (done) return;
          } else if (slots) {
            // Vegas: 7, 7, skull... and the machine falls on him
            const wr = walker.getBoundingClientRect();
            const fw = wr.width, fh = wr.height, ground = wr.bottom;
            const mh = fh * 1.6, mw = mh * 110 / 150;
            const mx = Math.min(W - mw - 24, wr.right + fw * 0.35);
            const mach = document.createElement("div");
            mach.className = "intro-slots2";
            mach.innerHTML = slotSVG();
            Object.assign(mach.style, { width: mw + "px", height: mh + "px", left: mx + "px", top: ground - mh + "px" });
            ov.append(mach);
            await mach.animate([{ transform: "translateY(" + (-ground) + "px)" }, { transform: "translateY(0)", offset: 0.8 },
              { transform: "translateY(-12px)", offset: 0.9 }, { transform: "translateY(0)" }], { duration: 650, easing: "ease-in", fill: "forwards" }).finished;
            if (done) return;
            ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-3px,2px)" }, { transform: "translate(0,0)" }], { duration: 180 });
            await sleep(250);
            if (done) return;

            await mach.querySelector(".lever").animate([{ transform: "rotate(0deg)" }, { transform: "rotate(130deg)" }, { transform: "rotate(0deg)" }],
              { duration: 500, easing: "ease-in-out" }).finished;
            if (done) return;
            const reels = [...mach.querySelectorAll(".reel")];
            const faces = ["7", "🍒", "⛳", "💰", "🔔"], finals = ["7", "7", "💀"];
            const spinning = [true, true, true];
            const iv = setInterval(() => reels.forEach((r, k) => { if (spinning[k]) r.textContent = faces[Math.floor(Math.random() * faces.length)]; }), 70);
            const tickIv = setInterval(() => Sound.play("tick"), 90);
            for (let k = 0; k < 3; k++) {
              await sleep(k === 2 ? 1000 : 600);
              spinning[k] = false;
              reels[k].textContent = finals[k];
              Sound.play(k === 2 ? "buzzer" : "pop");
              if (done) { clearInterval(iv); clearInterval(tickIv); return; }
            }
            clearInterval(iv);
            clearInterval(tickIv);
            await sleep(500);
            if (done) return;

            walker.classList.add("holding");
            setTimeout(() => Sound.play("thud"), 520);
            const fall = mach.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(-90deg)", offset: 0.85 },
              { transform: "rotate(-86deg)", offset: 0.93 }, { transform: "rotate(-90deg)" }],
              { duration: 650, easing: "cubic-bezier(.5,0,.9,.6)", fill: "forwards" });
            await sleep(650 * 0.8);
            if (done) return;
            wsvg.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.6,.08)" }], { duration: 120, fill: "forwards" });
            Object.assign(splat.style, { width: fw * 1.8 + "px", left: wr.left - fw * 0.4 + "px", top: ground - 5 + "px" });
            splat.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.3)" }], { duration: 700, easing: "ease-out" });
            ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-8px,5px)" }, { transform: "translate(7px,-4px)" },
              { transform: "translate(-3px,2px)" }, { transform: "translate(0,0)" }], { duration: 380 });
            await fall.finished;
            if (done) return;
            await sleep(600);
            if (done) return;
          } else if (carry) {
            // Best Ball: two teammates carry Crabby off
            const wr = walker.getBoundingClientRect();
            const fw = wr.width, fh = wr.height, ground = wr.bottom, cx = wr.left + fw / 2;
            const cols = PALETTE.filter(p => p[0] !== c).slice(0, 2).map(p => p[0]);
            const xs = [cx - fw * 0.9, cx + fw * 0.9];
            const figs = cols.map((col, k) => {
              const d = document.createElement("div");
              d.className = "intro-extra walking";
              d.style.setProperty("--c2", col);
              d.innerHTML = stickSVG();
              Object.assign(d.style, { width: fw * 0.8 + "px", height: fh * 0.8 + "px", left: xs[k] - fw * 0.4 + "px", top: ground - fh * 0.8 + "px" });
              ov.append(d);
              return d;
            });
            await Promise.all(figs.map((f, k) => f.animate([{ transform: "translateX(" + (k === 0 ? -(xs[0] + fw) : W - xs[1] + fw) + "px)" }, { transform: "none" }],
              { duration: 800, easing: "ease-out", fill: "forwards" }).finished));
            if (done) return;
            figs.forEach(f => { f.classList.remove("walking"); f.classList.add("holding"); });
            walker.classList.add("holding");
            walker.style.transformOrigin = "50% 50%";
            const lift = "translateY(" + (-fh * 0.55) + "px) rotate(-90deg)";
            await walker.animate([{ transform: "none" }, { transform: lift }], { duration: 500, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "forwards" }).finished;
            if (done) return;
            await sleep(250);
            if (done) return;
            figs.forEach(f => f.classList.add("walking"));
            const out = W - Math.min(...xs) + fw * 2;
            const exit = { duration: 1300, easing: "ease-in", fill: "forwards" };
            figs.forEach(f => f.animate([{ transform: "none" }, { transform: "translateX(" + out + "px)" }], exit));
            await walker.animate([{ transform: lift }, { transform: "translate(" + out + "px," + (-fh * 0.55) + "px) rotate(-90deg)" }], exit).finished;
            if (done) return;
          } else if (bbb) {
            // Bingo Bango Bongo: three balls, three hits
            const wr = walker.getBoundingClientRect();
            walker.style.transformOrigin = "50% 100%";
            const words = ["BINGO!", "BANGO!", "BONGO!"];
            const froms = [[W + 20, wr.top - 40], [-20, wr.top + wr.height * 0.2], [W + 20, wr.top + wr.height * 0.5]];
            const tilts = [-14, 12];
            for (let k = 0; k < 3; k++) {
              const ball = document.createElement("div");
              ball.className = "intro-ball";
              const tx = wr.left + wr.width / 2, ty = wr.top + wr.height * (0.15 + k * 0.2);
              Object.assign(ball.style, { left: froms[k][0] + "px", top: froms[k][1] + "px" });
              ov.append(ball);
              await ball.animate([{ transform: "translate(0,0)" }, { transform: "translate(" + (tx - froms[k][0]) + "px," + (ty - froms[k][1]) + "px)" }],
                { duration: 380, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }).finished;
              if (done) return;
              ball.remove();
              const pop = document.createElement("div");
              pop.className = "intro-bonk";
              pop.textContent = words[k];
              Sound.play("bonk");
              Object.assign(pop.style, { left: wr.left + wr.width / 2 + (k - 1) * wr.width * 1.4 + "px", top: wr.top - 10 + k * 18 + "px" });
              ov.append(pop);
              pop.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.4)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.2)" },
                { opacity: 0, transform: "translate(-50%,-90%) scale(1)" }], { duration: 900, fill: "forwards" });
              ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-5px,3px)" }, { transform: "translate(4px,-3px)" },
                { transform: "translate(0,0)" }], { duration: 220 });
              if (k < 2) {
                walker.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(" + tilts[k] + "deg)" }, { transform: "rotate(0deg)" }],
                  { duration: 420, easing: "ease-out" });
                await sleep(450);
              } else {
                walker.classList.add("holding");
                await walker.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(-90deg)" }],
                  { duration: 450, easing: "cubic-bezier(.5,0,.8,1.4)", fill: "forwards" }).finished;
              }
              if (done) return;
            }
            await sleep(300);
            if (done) return;
          } else if (cartRun) {
            // Match Play: a golf cart runs him over
            const wr = walker.getBoundingClientRect();
            const ch = wr.height * 0.8, cw = ch * 50 / 46;
            const cart = document.createElement("div");
            cart.className = "intro-cart";
            Sound.play("horn");
            cart.innerHTML = cartSVG((PALETTE.find(p => p[0] !== c) || ["#FFD84D"])[0]);
            Object.assign(cart.style, { width: cw + "px", height: ch + "px", left: "0px", top: wr.bottom - ch * 43 / 46 + "px" });
            ov.append(cart);
            const startX = -cw - 20, endX = W + 20, D = 1700;
            const hitX = wr.left + wr.width * 0.2 - cw * 0.96;
            const hitT = Math.max(0, (hitX - startX) / (endX - startX)) * D;
            cart.animate([{ transform: "translateX(" + startX + "px)" }, { transform: "translateX(" + endX + "px)" }],
              { duration: D, easing: "linear", fill: "forwards" });
            await sleep(hitT);
            if (done) return;
            Sound.play("thud");
            wsvg.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.6,.08)" }], { duration: 120, fill: "forwards" });
            Object.assign(splat.style, { width: wr.width * 1.6 + "px", left: wr.left - wr.width * 0.3 + "px", top: wr.bottom - 5 + "px" });
            splat.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.3)" }], { duration: 700, easing: "ease-out" });
            cart.querySelector("svg").animate([{ transform: "translateY(0) rotate(0deg)" },
              { transform: "translateY(" + (-ch * 0.18) + "px) rotate(-6deg)" }, { transform: "translateY(0) rotate(0deg)" }],
              { duration: 350, easing: "ease-out" });
            ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-6px,4px)" }, { transform: "translate(5px,-3px)" },
              { transform: "translate(0,0)" }], { duration: 300 });
            await sleep(D - hitT + 200);
            if (done) return;
          }
          Sound.play("pop");
          result.style.top = wolfGrab ? "52%" : "30%";
          result.textContent = message;
          result.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1.08)" }, { opacity: 1, transform: "scale(1)" }],
            { duration: 450, fill: "forwards" });
          await sleep(2000);
        } else {
          // Stroke Play: a golfer tees off and launches the walker
          const wr = walker.getBoundingClientRect();
          const gc = (PALETTE.find(p => p[0] !== c) || ["#FFD84D"])[0];
          const gw = wr.width * 44 / 40, gh = wr.height;
          const golfer = document.createElement("div");
          golfer.className = "intro-golfer walking";
          golfer.style.setProperty("--g", gc);
          golfer.innerHTML = golferSVG();
          const gLeft = Math.max(16, wr.left - Math.max(W * 0.32, wr.width * 2.5));
          const gTop = wr.bottom - gh;
          Object.assign(golfer.style, { width: gw + "px", height: gh + "px", left: gLeft + "px", top: gTop + "px" });
          ov.append(golfer);
          await golfer.animate([{ transform: "translateX(" + (-gLeft - gw - 20) + "px)" }, { transform: "none" }],
            { duration: 700, easing: "ease-out", fill: "forwards" }).finished;
          if (done) return;
          golfer.classList.remove("walking");

          const bx = gLeft + gw * 40 / 44, by = gTop + gh * 55 / 60;
          const ball = document.createElement("div");
          ball.className = "intro-ball";
          Object.assign(ball.style, { left: bx - 4 + "px", top: by - 4 + "px" });
          ov.append(ball);
          await ball.animate([{ transform: "scale(0)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }],
            { duration: 300, fill: "forwards" }).finished;
          if (done) return;
          await sleep(250);

          const swing = golfer.querySelector(".g-swing");
          await swing.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(130deg)" }],
            { duration: 500, easing: "ease-out", fill: "forwards" }).finished;
          if (done) return;
          await sleep(150);
          Sound.play("swing");
          swing.animate([{ transform: "rotate(130deg)" }, { transform: "rotate(-150deg)" }], { duration: 200, easing: "ease-in", fill: "forwards" });
          await sleep(120);
          if (done) return;

          const tx = wr.left + wr.width / 2 - bx, ty = wr.top + wr.height * 0.45 - by;
          await ball.animate([{ transform: "translate(0,0)" }, { transform: "translate(" + tx * 0.5 + "px," + (ty - 40) + "px)" },
            { transform: "translate(" + tx + "px," + ty + "px)" }], { duration: 280, easing: "linear", fill: "forwards" }).finished;
          if (done) return;
          ball.remove();

          const bonk = document.createElement("div");
          bonk.className = "intro-bonk";
          bonk.textContent = "BONK!";
          Sound.play("bonk");
          Object.assign(bonk.style, { left: wr.left + wr.width / 2 + "px", top: wr.top + "px" });
          ov.append(bonk);
          bonk.animate([{ opacity: 0, transform: "translate(-50%,-50%) scale(.4)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1.2)" },
            { opacity: 0, transform: "translate(-50%,-90%) scale(1)" }], { duration: 900, fill: "forwards" });
          ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-6px,4px)" }, { transform: "translate(5px,-4px)" },
            { transform: "translate(0,0)" }], { duration: 300 });
          walker.classList.add("holding");
          await walker.animate([{ transform: "none" },
            { transform: "translate(" + (W - wr.left + 120) + "px," + (-(wr.bottom + 120)) + "px) rotate(1080deg)" }],
            { duration: 1000, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" }).finished;
          if (done) return;
          await sleep(500);
        }
        return fadeOut();
      }

      // 3. Shadow grows, walker panics
      const wr = walker.getBoundingClientRect();
      const S = Math.min(W * 0.8, H * 0.46);
      const cx = wr.left + wr.width / 2, feet = wr.bottom;
      Object.assign(shadow.style, { width: S * 0.9 + "px", left: cx - S * 0.45 + "px", top: feet - 7 + "px" });
      walker.classList.add("holding", "strain");
      shadow.animate([{ opacity: 0, transform: "scale(.15)" }, { opacity: 1, transform: "scale(1)" }], { duration: 1100, easing: "ease-in", fill: "forwards" });
      await sleep(500);
      if (done) return;

      // 4. Drop + crush
      Object.assign(wrap.style, { width: S + "px", height: S + "px", left: cx - S / 2 + "px", top: feet - S + "px", opacity: 1, transformOrigin: "50% 100%" });
      await wrap.animate([{ transform: "translateY(" + (-feet) + "px)" }, { transform: "translateY(0)" }],
        { duration: 600, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" }).finished;
      if (done) return;
      Sound.play("thud");
      walker.classList.remove("strain");
      wsvg.animate([{ transform: "scale(1,1)" }, { transform: "scale(1.6,.08)" }], { duration: 120, fill: "forwards" });
      Object.assign(splat.style, { width: S * 0.7 + "px", left: cx - S * 0.35 + "px", top: feet - 5 + "px" });
      splat.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.3)" }], { duration: 700, easing: "ease-out" });
      wrap.animate([{ transform: "scaleY(.93)" }, { transform: "scaleY(1)" }], { duration: 260, easing: "ease-out" });
      ov.animate([{ transform: "translate(0,0)" }, { transform: "translate(-8px,6px)" }, { transform: "translate(7px,-5px)" },
        { transform: "translate(-4px,3px)" }, { transform: "translate(0,0)" }], { duration: 350 });
      await sleep(700);
      if (done) return;

      // 5. Spin: fast start, long slow-down, pointer ticks
      live.style.top = feet + 18 + "px";
      result.style.top = feet + 14 + "px";
      const n = items.length, step = 360 / n;
      const target = 360 * 6 + ((360 - idx * step) % 360 + 360) % 360 + (Math.random() - 0.5) * step * 0.7;
      const D = 4800, t0 = performance.now();
      let lastSlice = -1, lastTickT = 0;
      await new Promise(res => {
        const frame = (now) => {
          if (done) return res();
          const t = Math.min(1, (now - t0) / D);
          const a = target * (1 - Math.pow(1 - t, 4));
          wheel.style.transform = "rotate(" + a + "deg)";
          const s = Math.round(((360 - (a % 360)) % 360) / step) % n;
          if (s !== lastSlice) {
            lastSlice = s;
            if (now - lastTickT > 45) { Sound.play("tick"); lastTickT = now; }
            pointer.animate([{ transform: "translateX(-50%) rotate(0deg)" }, { transform: "translateX(-50%) rotate(-22deg)" },
              { transform: "translateX(-50%) rotate(0deg)" }], { duration: 110 });
            if (t > 0.45) live.textContent = items[s][0];
          }
          if (t < 1) requestAnimationFrame(frame); else res();
        };
        requestAnimationFrame(frame);
      });
      if (done) return;

      // 6. Reveal
      await sleep(250);
      live.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      showResult();
      Sound.play(challenge.pts < 0 || challenge.text.startsWith("CURSE") ? "sad" : "fanfare");
      result.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1.08)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: 450, fill: "forwards" });
      await sleep(1600);
      fadeOut();
    })().catch(finish);
  });
}
