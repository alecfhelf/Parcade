// ---------- Sound: synthesized in the browser, no audio files ----------
const Sound = (() => {
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch (e) {} };
  let sfxOn = load("parful-sfx", true), musicOn = load("parful-music", true), wantMusic = false;
  let ctx = null, master = null, musicBus = null, hatBuf = null;

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.35; musicBus.connect(master);
    }
    return ctx;
  }
  const unlock = () => { const c = ac(); if (c) c.resume().then(syncMusic).catch(() => {}); };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  document.addEventListener("visibilitychange", () => syncMusic());
  const live = () => !!ctx && ctx.state === "running";

  function voice(freq, dur, t, type, vol, bus, slide, attack = 0.005) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function tone(freq, dur, o = {}) {
    if (!sfxOn || !live()) return;
    voice(freq, dur, ctx.currentTime + (o.at || 0), o.type || "square", o.vol || 0.2, master, o.slide, o.attack);
  }
  function noise(dur, o = {}) {
    if (!sfxOn || !live()) return;
    const t = ctx.currentTime + (o.at || 0);
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = o.filterType || "lowpass"; f.frequency.value = o.filter || 1200;
    const g = ctx.createGain(); g.gain.value = o.vol || 0.3;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  function grunt(at, dur) {
    if (!sfxOn || !live()) return;
    const t = ctx.currentTime + at, f0 = 85 + Math.random() * 60;
    const o = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0 * 1.15, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
    flt.type = "bandpass";
    flt.frequency.value = 450 + Math.random() * 350;
    flt.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt); flt.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function howl() {
    if (!sfxOn || !live()) return;
    const t = ctx.currentTime, D = 1.9;
    const out = ctx.createGain();
    const dly = ctx.createDelay(), fb = ctx.createGain();
    dly.delayTime.value = 0.22;
    fb.gain.value = 0.3;
    out.connect(master); out.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(master);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.35, t + 0.3);
    env.gain.setValueAtTime(0.35, t + 1.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t + D);
    env.connect(out);

    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoG.gain.value = 9;
    lfo.connect(lfoG);
    [[1, "sine", 1], [2, "triangle", 0.18]].forEach(([mult, type, vol]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(330 * mult, t);
      o.frequency.exponentialRampToValueAtTime(680 * mult, t + 0.45);
      o.frequency.linearRampToValueAtTime(740 * mult, t + 1.2);
      o.frequency.exponentialRampToValueAtTime(420 * mult, t + D);
      lfoG.connect(o.frequency);
      g.gain.value = vol;
      o.connect(g); g.connect(env);
      o.start(t); o.stop(t + D + 0.1);
    });

    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * D), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource();
    n.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
    bp.frequency.exponentialRampToValueAtTime(900, t + D);
    const ng = ctx.createGain();
    ng.gain.value = 0.12;
    n.connect(bp); bp.connect(ng); ng.connect(env);
    n.start(t);
    lfo.start(t); lfo.stop(t + D + 0.1);
    setTimeout(() => { try { out.disconnect(); dly.disconnect(); fb.disconnect(); } catch (e) {} }, (D + 2) * 1000);
  }

  const FX = {
    tick: () => tone(1800, 0.03, { vol: 0.07 }),
    pop: () => tone(520, 0.09, { type: "triangle", vol: 0.25, slide: 880 }),
    blip: () => { tone(880, 0.06, { type: "sine", vol: 0.15 }); tone(1320, 0.08, { type: "sine", vol: 0.12, at: 0.06 }); },
    thud: () => { tone(120, 0.35, { type: "sine", vol: 0.6, slide: 40 }); noise(0.25, { vol: 0.35, filter: 400 }); },
    bonk: () => { tone(700, 0.18, { vol: 0.22, slide: 180 }); noise(0.08, { vol: 0.2, filter: 2500 }); },
    flicker: () => { for (let i = 0; i < 4; i++) tone(120, 0.05, { type: "sawtooth", vol: 0.06, at: i * 0.09 }); },
    whoosh: () => noise(0.45, { vol: 0.25, filter: 900, filterType: "bandpass" }),
    swing: () => noise(0.18, { vol: 0.3, filter: 2200, filterType: "bandpass" }),
    fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { vol: 0.14, at: i * 0.1 })),
    ace: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.16, { vol: 0.13, at: i * 0.07 })),
    sad: () => [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.28, { type: "sawtooth", vol: 0.12, at: i * 0.3, slide: i === 3 ? 260 : null })),
    coin: () => { tone(988, 0.07, { vol: 0.1 }); tone(1319, 0.2, { vol: 0.1, at: 0.07 }); },
    howl: () => howl(),
    horn: () => [0, 0.3].forEach(at => { tone(330, 0.25, { type: "sawtooth", vol: 0.14, at }); tone(415, 0.25, { type: "sawtooth", vol: 0.11, at }); }),
    buzzer: () => tone(110, 0.6, { type: "sawtooth", vol: 0.2 }),
  };

  // Music: a little chiptune loop (Am, F, G, E)
  const EIGHTH = 60 / 112 / 2;
  const PROG = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 207.65, 246.94]];
  let timer = null, step = 0, nextT = 0;
  function hat(t) {
    if (!hatBuf) {
      hatBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
      const d = hatBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const s = ctx.createBufferSource(); s.buffer = hatBuf;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0.15;
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t);
  }
  function schedule() {
    while (nextT < ctx.currentTime + 0.25) {
      const chord = PROG[Math.floor(step / 8) % 4], s = step % 8;
      if (s === 0 || s === 3 || s === 4 || s === 6) voice(chord[0] / 2, EIGHTH * 1.6, nextT, "triangle", 0.5, musicBus);
      voice(chord[[0, 1, 2, 1][s % 4]] * 2, EIGHTH * 0.7, nextT, "square", 0.1, musicBus);
      if (s % 2 === 1) hat(nextT);
      nextT += EIGHTH;
      step++;
    }
  }
  function syncMusic() {
    const should = musicOn && wantMusic && live() && !document.hidden;
    if (should && !timer) { nextT = ctx.currentTime + 0.05; timer = setInterval(schedule, 60); }
    else if (!should && timer) { clearInterval(timer); timer = null; }
  }

  return {
    play(name) { try { if (FX[name]) FX[name](); } catch (e) {} },
    grumble(len) {
      const n = Math.min(9, Math.max(3, Math.round(len / 14)));
      try { for (let i = 0; i < n; i++) grunt(i * 0.13 + Math.random() * 0.03, 0.08 + Math.random() * 0.06); } catch (e) {}
      return n * 0.13;
    },
    music(want) { wantMusic = want; syncMusic(); },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    setSfx(v) { sfxOn = v; save("parful-sfx", v); },
    setMusic(v) { musicOn = v; save("parful-music", v); syncMusic(); },
  };
})();

function soundButton() {
  const b = document.createElement("button");
  b.className = "copy-top sound-btn";
  const states = [[true, true, "Sound: On"], [true, false, "Sound: FX only"], [false, false, "Sound: Off"]];
  const idx = () => states.findIndex(st => st[0] === Sound.sfxOn && st[1] === Sound.musicOn);
  const icons = [
    '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
    '<path d="M16 8.5a5 5 0 0 1 0 7"/>',
    '<path d="M16 9l5 6M21 9l-5 6"/>',
  ];
  const sync = () => {
    const i = Math.max(0, idx());
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/>' + icons[i] + '</svg>';
    b.setAttribute("aria-label", states[i][2]);
    b.title = states[i][2];
  };
  b.onclick = () => {
    const n = states[(idx() + 1) % states.length];
    Sound.setSfx(n[0]);
    Sound.setMusic(n[1]);
    sync();
    if (n[0]) Sound.play("pop");
  };
  sync();
  return b;
}
