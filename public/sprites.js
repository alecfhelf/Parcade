// ---------- Pixel characters ----------
// Ported from briefs/character-lab.html. One 22x30 pixel grid; body coordinates are offset so hats and raised items
// have headroom and every edge gets a 1px outline. Every piece is a layer on the same 16 pixel body, so clothes, hair
// and colors line up in any pose and at any size. Wrapped so the short names stay out of the shared global scope.
// The results poses (fist, clap, slump) use the same structure plus: drop (head and face move down), front (rects
// drawn over the shirt, with their colors set), cut (pixels cleared after the shirt) and noItem.
const PX = (() => {
  const W = 22, H = 30, OX = 3, OY = 5, OUTLINE = "#0A0D18";

  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbToHex([r, g, b]) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
  const shade = (h, k = 0.76) => rgbToHex(hexToRgb(h).map(v => v * k));
  const tint = (h, k = 0.5) => rgbToHex(hexToRgb(h).map(v => v + (255 - v) * k));
  const lum = h => { const [r, g, b] = hexToRgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  const SKINS = ["#FFE0C4", "#F4C9A0", "#E0AC69", "#C68642", "#8D5524", "#5C3A21"];
  const HAIRC = ["#1E1B1B", "#4A2E1F", "#8A5A35", "#E8C15A", "#B5432B", "#A7ADB5", "#F2F2F2", "#3D7BFF", "#FF5CA8", "#3CCB6A"];
  const EYES = ["#3B2416", "#2E6BFF", "#2E9E5B", "#8E6B2E", "#6B7785", "#7A3FCB"];
  const CLOTH = ["#2E6BFF", "#5CE1FF", "#FF5C7A", "#FFD84D", "#3CCB6A", "#B46BFF", "#FF9F43", "#F2F5FA", "#2A2F45", "#C8A27A", "#1F3B73", "#8B1E3F"];

  // Poses: where the arms and the item hand are.
  const POSES = {
    idle: { arms: [[2, 10, 2, 6], [12, 10, 2, 6]], hands: [[2, 16, 2, 1], [12, 16, 2, 1]], shoulders: [], short: [[2, 10, 2, 2], [12, 10, 2, 2]], up: false, hand: { x: 12, y: 16 } },
    cheer: { arms: [[1, 3, 2, 7], [13, 3, 2, 7]], hands: [[1, 2, 2, 1], [13, 2, 2, 1]], shoulders: [[3, 10, 1, 1], [12, 10, 1, 1], [2, 9, 1, 2], [13, 9, 1, 2]],
             short: [[1, 8, 2, 2], [13, 8, 2, 2], [3, 10, 1, 1], [12, 10, 1, 1], [2, 9, 1, 2], [13, 9, 1, 2]], up: true, hand: { x: 13, y: 2 } },
    // 2nd: left arm up in a fist, right arm down with the item
    fist: { arms: [[1, 3, 2, 7], [12, 10, 2, 6]], hands: [[0, 1, 3, 2], [12, 16, 2, 1]], shoulders: [[3, 10, 1, 1], [2, 9, 1, 2]],
            short: [[1, 8, 2, 2], [3, 10, 1, 1], [2, 9, 1, 2], [12, 10, 2, 2]], up: false, hand: { x: 12, y: 16 } },
    // 3rd: upper arms at the sides, forearms across the shirt, hands together in front of the chest
    clap: { arms: [[2, 10, 2, 4], [12, 10, 2, 4]], hands: [], shoulders: [], short: [[2, 10, 2, 2], [12, 10, 2, 2]], up: false, hand: { x: 12, y: 16 }, noItem: true,
            front: [[4, 14, 3, 1, OUTLINE], [9, 14, 3, 1, OUTLINE], [6, 11, 1, 1, OUTLINE], [9, 11, 1, 1, OUTLINE], [6, 10, 4, 1, OUTLINE],
                    [4, 12, 3, 1, "s"], [9, 12, 3, 1, "s"], [4, 13, 3, 1, "S"], [9, 13, 3, 1, "S"], [7, 11, 2, 3, "s"], [7, 13, 2, 1, "S"]] },
    // Second clap frame: hands apart
    clap2: { arms: [[2, 10, 2, 4], [12, 10, 2, 4]], hands: [], shoulders: [], short: [[2, 10, 2, 2], [12, 10, 2, 2]], up: false, hand: { x: 12, y: 16 }, noItem: true,
             front: [[4, 14, 3, 1, OUTLINE], [9, 14, 3, 1, OUTLINE], [5, 10, 2, 1, OUTLINE], [9, 10, 2, 1, OUTLINE], [7, 11, 2, 3, OUTLINE],
                     [4, 12, 2, 1, "s"], [10, 12, 2, 1, "s"], [4, 13, 3, 1, "S"], [9, 13, 3, 1, "S"], [5, 11, 2, 2, "s"], [9, 11, 2, 2, "s"]] },
    // Dead last: head dropped a pixel, shoulders down, arms hanging
    slump: { arms: [[2, 11, 2, 6], [12, 11, 2, 6]], hands: [[2, 17, 2, 1], [12, 17, 2, 1]], shoulders: [], short: [[2, 11, 2, 2], [12, 11, 2, 2]], up: false, hand: { x: 12, y: 17 },
             drop: 1, cut: [[4, 10, 1, 1], [11, 10, 1, 1]] },
  };

  const R = (x, y, w, h, t) => ({ x, y, w, h, t });
  Object.values(POSES).forEach(p => ["arms", "hands", "shoulders", "short", "front", "cut"].forEach(k => { if (p[k]) p[k] = p[k].map(a => R(...a)); }));
  const DOTS = (pts, t) => pts.map(([x, y]) => R(x, y, 1, 1, t));

  // ---------- Wardrobe ----------
  const HAIR = [
    { id: "short", name: "Short", draw: () => [R(4, 1, 8, 2, "h"), R(3, 2, 1, 3, "h"), R(12, 2, 1, 3, "h"), R(4, 3, 1, 1, "h"), R(11, 3, 1, 1, "h"), R(6, 2, 4, 1, "H")] },
    { id: "buzz", name: "Buzz", draw: () => [R(5, 1, 6, 1, "H"), R(4, 2, 8, 1, "H")] },
    { id: "long", name: "Long", draw: () => [R(4, 1, 8, 2, "h"), R(3, 2, 1, 8, "h"), R(12, 2, 1, 8, "h"), R(2, 5, 1, 5, "h"), R(13, 5, 1, 5, "h"), R(4, 3, 1, 1, "h"), R(11, 3, 1, 1, "h"), R(6, 2, 4, 1, "H")] },
    { id: "curly", name: "Curls", draw: () => [R(3, 0, 10, 3, "h"), R(2, 1, 12, 3, "h"), R(2, 4, 1, 4, "h"), R(13, 4, 1, 4, "h"), R(3, 4, 1, 1, "h"), R(12, 4, 1, 1, "h"),
        ...DOTS([[4, 1], [7, 0], [10, 1], [5, 3], [9, 2], [12, 2], [2, 5], [13, 6]], "H")] },
    { id: "pony", name: "Ponytail", draw: () => [R(4, 1, 8, 2, "h"), R(3, 2, 1, 3, "h"), R(12, 2, 1, 3, "h"), R(4, 3, 1, 1, "h"), R(11, 3, 1, 1, "h"), R(13, 3, 2, 2, "h"), R(14, 5, 1, 3, "h"), R(6, 2, 4, 1, "H")] },
    { id: "mohawk", name: "Mohawk", draw: () => [R(7, -1, 2, 4, "h"), R(6, 1, 4, 1, "H")] },
    { id: "bald", name: "Bald", draw: () => [R(9, 3, 1, 1, "L")] },
  ];
  const FACE = [
    { id: "none", name: "None", draw: () => [] },
    { id: "stache", name: "Mustache", draw: () => [R(6, 7, 4, 1, "h")] },
    { id: "beard", name: "Beard", draw: () => [R(4, 6, 1, 2, "h"), R(11, 6, 1, 2, "h"), R(5, 8, 6, 1, "h"), R(5, 7, 2, 1, "h"), R(9, 7, 2, 1, "h")] },
    { id: "goatee", name: "Goatee", draw: () => [R(7, 8, 2, 1, "h"), R(6, 7, 1, 1, "h"), R(9, 7, 1, 1, "h")] },
  ];
  const shortSleeves = p => p.short.map(r => ({ ...r, t: "t" }));
  const longSleeves = p => p.arms.map(r => ({ ...r, t: "t" })).concat(p.shoulders.map(r => ({ ...r, t: "t" })));
  const SHIRTS = [
    { id: "tee", name: "Tee", rarity: "common", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...shortSleeves(p), R(7, 10, 2, 1, "S")] },
    { id: "polo", name: "Polo", rarity: "common", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...shortSleeves(p), R(5, 10, 2, 1, "a"), R(9, 10, 2, 1, "a"), R(7, 10, 2, 2, "T"), R(7, 10, 2, 1, "S")] },
    { id: "stripe", name: "Striped", rarity: "common", draw: p => [R(4, 10, 8, 6, "t"), ...shortSleeves(p), R(4, 11, 8, 1, "a"), R(4, 13, 8, 1, "a"), R(4, 15, 8, 1, "a"), R(7, 10, 2, 1, "S")] },
    { id: "hoodie", name: "Hoodie", rarity: "rare", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...longSleeves(p), R(5, 9, 6, 1, "T"), R(7, 9, 2, 1, "S"), R(5, 13, 6, 2, "T"),
        ...DOTS([[6, 10], [6, 11], [9, 10], [9, 11]], "W")] },
    { id: "argyle", name: "Argyle vest", rarity: "rare", draw: p => {
        const out = [R(4, 10, 8, 6, "t"), ...p.short.map(r => ({ ...r, t: "W" })), R(6, 10, 4, 1, "W"), R(7, 10, 2, 1, "S")];
        for (let y = 11; y <= 15; y++) for (let x = 4; x <= 11; x++) if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) out.push(R(x, y, 1, 1, "a"));
        return out; } },
    { id: "hawaii", name: "Hawaiian", rarity: "epic", draw: p => [R(4, 10, 8, 6, "t"), ...shortSleeves(p), R(6, 10, 4, 1, "S"), R(7, 11, 2, 1, "S"),
        ...DOTS([[5, 11], [10, 12], [6, 14], [9, 15], [4, 13], [11, 14]], "y"), ...DOTS([[8, 13], [5, 15], [10, 10]], "W")] },
  ];
  const PANTS = [
    { id: "slacks", name: "Slacks", rarity: "common", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 5, "p"), R(9, 17, 3, 5, "p"), R(7, 17, 2, 1, "p"), R(6, 17, 1, 5, "P"), R(11, 17, 1, 5, "P")] },
    { id: "shorts", name: "Shorts", rarity: "common", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 2, "p"), R(9, 17, 3, 2, "p"), R(7, 17, 2, 1, "p"), R(6, 17, 1, 2, "P"), R(11, 17, 1, 2, "P")] },
    { id: "joggers", name: "Joggers", rarity: "common", draw: () => [R(4, 16, 8, 1, "P"), R(4, 17, 3, 5, "p"), R(9, 17, 3, 5, "p"), R(7, 17, 2, 1, "p"), R(4, 21, 3, 1, "P"), R(9, 21, 3, 1, "P"), ...DOTS([[7, 17], [8, 17]], "W")] },
    { id: "plaid", name: "Plaid", rarity: "rare", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 5, "p"), R(9, 17, 3, 5, "p"), R(7, 17, 2, 1, "p"),
        R(4, 18, 3, 1, "q"), R(9, 18, 3, 1, "q"), R(4, 20, 3, 1, "q"), R(9, 20, 3, 1, "q"), R(5, 17, 1, 5, "q"), R(10, 17, 1, 5, "q")] },
  ];
  const SHOES = [
    { id: "sneakers", name: "Sneakers", rarity: "common", draw: () => [R(3, 22, 4, 1, "o"), R(9, 22, 4, 1, "o"), R(3, 23, 4, 1, "n"), R(9, 23, 4, 1, "n"), R(5, 22, 1, 1, "W"), R(10, 22, 1, 1, "W")] },
    { id: "spikes", name: "Golf spikes", rarity: "common", draw: () => [R(3, 22, 4, 1, "W"), R(9, 22, 4, 1, "W"), R(4, 22, 2, 1, "o"), R(10, 22, 2, 1, "o"), R(3, 23, 4, 1, "k"), R(9, 23, 4, 1, "k")] },
    { id: "boots", name: "Boots", rarity: "rare", draw: () => [R(4, 20, 3, 2, "o"), R(9, 20, 3, 2, "o"), R(3, 22, 4, 1, "o"), R(9, 22, 4, 1, "o"), R(3, 23, 4, 1, "O"), R(9, 23, 4, 1, "O")] },
  ];
  const HATS = [
    { id: null, name: "None", rarity: "common", draw: () => [] },
    { id: "cap", name: "Cap", rarity: "common", draw: () => [R(4, 0, 8, 3, "c"), R(4, 0, 1, 1, "_"), R(11, 0, 1, 1, "_"), R(7, 0, 2, 1, "C"), R(3, 3, 10, 1, "C")] },
    { id: "bucket", name: "Bucket hat", rarity: "common", draw: () => [R(5, -1, 6, 2, "c"), R(4, 1, 8, 2, "c"), R(3, 3, 10, 1, "C")] },
    { id: "visor", name: "Visor", rarity: "common", draw: () => [R(4, 3, 8, 1, "c"), R(3, 4, 10, 1, "C")] },
    { id: "beanie", name: "Beanie", rarity: "rare", draw: () => [R(4, 0, 8, 3, "c"), R(4, 0, 1, 1, "_"), R(11, 0, 1, 1, "_"), R(4, 3, 8, 1, "C"), R(7, -2, 2, 2, "W")] },
    { id: "tophat", name: "Top hat", rarity: "epic", draw: () => [R(5, -3, 6, 5, "k"), R(5, 0, 6, 1, "c"), R(3, 2, 10, 1, "k")] },
    { id: "crown", name: "Crown", rarity: "legendary", draw: () => [R(4, 0, 8, 2, "g"), R(4, 1, 8, 1, "G"), R(4, -1, 1, 1, "g"), R(7, -2, 2, 2, "g"), R(11, -1, 1, 1, "g"), R(5, 1, 1, 1, "r"), R(10, 1, 1, 1, "r"), R(7, 0, 2, 1, "r")] },
  ];
  const ITEMS = [
    { id: null, name: "None", rarity: "common", draw: () => [] },
    { id: "driver", name: "Driver", rarity: "common", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 6, 1, 7, "x"), R(h.x + 1, h.y - 7, 2, 1, "k"), R(h.x + 2, h.y - 8, 1, 1, "k")]
        : [R(h.x + 2, h.y - 1, 1, 7, "x"), R(h.x + 2, h.y + 6, 2, 1, "k"), R(h.x + 3, h.y + 5, 1, 1, "k")] },
    { id: "putter", name: "Putter", rarity: "common", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 6, 1, 7, "x"), R(h.x, h.y - 7, 3, 1, "y")]
        : [R(h.x + 2, h.y - 1, 1, 7, "x"), R(h.x + 1, h.y + 6, 3, 1, "y")] },
    { id: "coffee", name: "Coffee", rarity: "common", draw: (p, h) => p.up
        ? [R(h.x, h.y - 3, 2, 3, "W"), R(h.x, h.y - 4, 2, 1, "k"), R(h.x, h.y - 2, 2, 1, "b")]
        : [R(h.x + 2, h.y - 2, 2, 3, "W"), R(h.x + 2, h.y - 3, 2, 1, "k"), R(h.x + 2, h.y - 1, 2, 1, "b"), R(h.x + 3, h.y - 5, 1, 1, "y"), R(h.x + 2, h.y - 6, 1, 1, "y")] },
    { id: "flag", name: "Pin flag", rarity: "rare", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 7, 1, 9, "W"), R(h.x + 2, h.y - 7, 2, 3, "f"), R(h.x + 2, h.y - 6, 1, 1, "F")]
        : [R(h.x + 2, h.y - 13, 1, 20, "W"), R(h.x + 3, h.y - 13, 2, 3, "f"), R(h.x + 3, h.y - 12, 1, 1, "F")] },
    { id: "trophy", name: "Trophy", rarity: "legendary", draw: (p, h) => p.up
        ? [R(h.x - 1, h.y - 5, 4, 3, "g"), R(h.x - 2, h.y - 5, 1, 2, "G"), R(h.x + 3, h.y - 5, 1, 2, "G"), R(h.x, h.y - 2, 2, 1, "G"), R(h.x - 1, h.y - 1, 4, 1, "b")]
        : [R(h.x + 2, h.y - 4, 3, 3, "g"), R(h.x + 2, h.y - 1, 3, 1, "G"), R(h.x + 3, h.y, 1, 1, "G"), R(h.x + 2, h.y + 1, 3, 1, "b")] },
  ];
  // Store hooks: every piece has a rarity and a price (null = free for now; see outfitOwned in outfits.js)
  [HAIR, FACE, SHIRTS, PANTS, SHOES, HATS, ITEMS].forEach(list => list.forEach(it => { it.rarity = it.rarity || "common"; it.price = null; }));

  const DEFAULT = { skin: SKINS[1], eyes: EYES[0], hair: "short", hairColor: HAIRC[1], face: "none",
    shirt: "polo", shirtColor: CLOTH[0], pants: "slacks", pantsColor: CLOTH[10], shoes: "spikes", shoeColor: CLOTH[2],
    hat: "cap", hatColor: CLOTH[7], item: "driver" };

  function render(o, poseName = "idle") {
    const p = POSES[poseName] || POSES.idle;
    const grid = Array.from({ length: H }, () => Array(W).fill(null));
    const clothAccent = c => lum(c) > 0.6 ? "#1F3B73" : tint(c, 0.65);
    const pal = {
      s: o.skin, S: shade(o.skin, 0.86), m: shade(o.skin, 0.62), L: tint(o.skin, 0.45),
      h: o.hairColor, H: shade(o.hairColor, 0.72), e: o.eyes,
      t: o.shirtColor, T: shade(o.shirtColor), a: clothAccent(o.shirtColor), y: "#FFD84D",
      p: o.pantsColor, P: shade(o.pantsColor), q: clothAccent(o.pantsColor),
      o: o.shoeColor, O: shade(o.shoeColor, 0.6), n: "#E6EAF2",
      c: o.hatColor, C: shade(o.hatColor),
      g: "#FFD84D", G: "#C99A1E", r: "#FF3B5C", k: "#1A1C26", W: "#F2F5FA", x: "#B8C2D6", b: "#7A4A2A", f: "#FF3B5C", F: "#C21F3C",
    };
    const put = list => list.forEach(r => {
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) {
        const gx = xx + OX, gy = yy + OY;
        if (gx < 1 || gy < 1 || gx >= W - 1 || gy >= H - 1) continue;
        grid[gy][gx] = r.t === "_" ? null : (pal[r.t] || r.t);
      }
    });
    const find = (list, id) => list.find(i => i.id === id) || list[0];
    const head = list => p.drop ? list.map(r => ({ ...r, y: r.y + p.drop })) : list;

    // body
    put([...head([R(4, 2, 8, 7, "s"), R(4, 2, 1, 1, "_"), R(11, 2, 1, 1, "_"), R(4, 8, 1, 1, "_"), R(11, 8, 1, 1, "_"), R(11, 3, 1, 5, "S"),
         R(3, 5, 1, 2, "s"), R(12, 5, 1, 2, "S")]), R(7, 9, 2, 1, "S"), R(4, 10, 8, 6, "s"),
         ...p.arms.map(r => ({ ...r, t: "s" })), ...p.shoulders.map(r => ({ ...r, t: "s" })), ...p.hands.map(r => ({ ...r, t: "s" })),
         R(4, 16, 8, 1, "s"), R(4, 17, 3, 5, "s"), R(9, 17, 3, 5, "s"), R(4, 22, 3, 1, "s"), R(9, 22, 3, 1, "s")]);
    // face
    put(head([R(6, 5, 1, 2, "e"), R(9, 5, 1, 2, "e"), R(5, 4, 2, 1, "H"), R(9, 4, 2, 1, "H"), R(7, 7, 2, 1, "m")]));
    // hair (trimmed under hats)
    let hair = find(HAIR, o.hair).draw();
    if (o.hat) hair = hair.filter(r => r.y >= 1).map(r => r);
    put(head(hair));
    put(head(find(FACE, o.face).draw()));
    put(find(PANTS, o.pants).draw(p));
    put(find(SHOES, o.shoes).draw(p));
    put(find(SHIRTS, o.shirt).draw(p));
    if (p.cut) put(p.cut.map(r => ({ ...r, t: "_" })));
    put(head(find(HATS, o.hat).draw(p)));
    if (!p.noItem) put(find(ITEMS, o.item).draw(p, p.hand));
    put(p.hands.slice(1).map(r => ({ ...r, t: "s" }))); // the hand grips over the item
    if (p.front) put(p.front);

    // 1px outline around the whole silhouette
    const out = grid.map(row => row.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (grid[y][x]) continue;
      if ((grid[y - 1] && grid[y - 1][x]) || (grid[y + 1] && grid[y + 1][x]) || grid[y][x - 1] || grid[y][x + 1]) out[y][x] = OUTLINE;
    }
    let rects = "";
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const c = out[y][x];
        if (!c) { x++; continue; }
        let x2 = x + 1;
        while (x2 < W && out[y][x2] === c) x2++;
        rects += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" fill="' + c + '"/>';
        x = x2;
      }
    }
    return '<svg class="px" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges" aria-hidden="true">' + rects + "</svg>";
  }

  // Leaderboards repeat the same few figures, so rendered strings are kept by outfit + pose
  const KEYS = Object.keys(DEFAULT);
  const cache = new Map();
  function svg(o, pose = "idle") {
    const key = pose + "|" + KEYS.map(k => o[k]).join("|");
    let s = cache.get(key);
    if (s === undefined) {
      s = render(o, pose);
      if (cache.size > 500) cache.clear();
      cache.set(key, s);
    }
    return s;
  }

  return { W, H, SKINS, EYES, HAIRC, CLOTH, HAIR, FACE, SHIRTS, PANTS, SHOES, HATS, ITEMS, DEFAULT, POSES, render, svg };
})();
