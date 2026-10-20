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

  // cls: an optional CSS class for animated pixels (px-blink, px-glow, px-flame, px-twinkle; styled in index.html)
  const R = (x, y, w, h, t, cls) => ({ x, y, w, h, t, cls });
  Object.values(POSES).forEach(p => ["arms", "hands", "shoulders", "short", "front", "cut"].forEach(k => { if (p[k]) p[k] = p[k].map(a => R(...a)); }));
  const DOTS = (pts, t, cls) => pts.map(([x, y]) => R(x, y, 1, 1, t, cls));
  // One row at the hand end of each arm (top for raised arms), for sleeve cuffs
  const cuffs = (p, t) => p.arms.map(r => R(r.x, r.y < 10 ? r.y : r.y + r.h - 1, r.w, 1, t));

  // Rarity tiers, cheapest first. Bogey gear is free and everyone owns it. Prices for the rest live only in the
  // shop_items table (supabase/pro-shop.sql).
  const RARITY = [{ id: "bogey", name: "Bogey" }, { id: "par", name: "Par" }, { id: "birdie", name: "Birdie" },
    { id: "eagle", name: "Eagle" }, { id: "albatross", name: "Albatross" }];
  const SPARK = "#FFF6C2", NEON_PINK = "#FF3DF2", NEON_MINT = "#39FFB0", LASER = "#5CE1FF", CHICKEN = "#FFE14D", BEAK = "#FF9F43";

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
    { id: "tee", name: "Tee", rarity: "bogey", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...shortSleeves(p), R(7, 10, 2, 1, "S")] },
    { id: "polo", name: "Polo", rarity: "bogey", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...shortSleeves(p), R(5, 10, 2, 1, "a"), R(9, 10, 2, 1, "a"), R(7, 10, 2, 2, "T"), R(7, 10, 2, 1, "S")] },
    { id: "stripe", name: "Striped", rarity: "bogey", draw: p => [R(4, 10, 8, 6, "t"), ...shortSleeves(p), R(4, 11, 8, 1, "a"), R(4, 13, 8, 1, "a"), R(4, 15, 8, 1, "a"), R(7, 10, 2, 1, "S")] },
    { id: "hoodie", name: "Hoodie", rarity: "bogey", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...longSleeves(p), R(5, 9, 6, 1, "T"), R(7, 9, 2, 1, "S"), R(5, 13, 6, 2, "T"),
        ...DOTS([[6, 10], [6, 11], [9, 10], [9, 11]], "W")] },
    { id: "argyle", name: "Argyle vest", rarity: "bogey", draw: p => {
        const out = [R(4, 10, 8, 6, "t"), ...p.short.map(r => ({ ...r, t: "W" })), R(6, 10, 4, 1, "W"), R(7, 10, 2, 1, "S")];
        for (let y = 11; y <= 15; y++) for (let x = 4; x <= 11; x++) if ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) out.push(R(x, y, 1, 1, "a"));
        return out; } },
    { id: "hawaii", name: "Hawaiian", rarity: "bogey", draw: p => [R(4, 10, 8, 6, "t"), ...shortSleeves(p), R(6, 10, 4, 1, "S"), R(7, 11, 2, 1, "S"),
        ...DOTS([[5, 11], [10, 12], [6, 14], [9, 15], [4, 13], [11, 14]], "y"), ...DOTS([[8, 13], [5, 15], [10, 10]], "W")] },
    // Pro Shop
    { id: "rugby", name: "Rugby stripe", rarity: "par", draw: p => [R(4, 10, 8, 6, "t"), ...longSleeves(p), ...cuffs(p, "W"), R(4, 12, 8, 2, "a"), R(4, 15, 8, 1, "a"),
        R(5, 10, 2, 1, "W"), R(9, 10, 2, 1, "W"), R(7, 10, 2, 1, "S"), R(7, 11, 2, 1, "W"), R(8, 11, 1, 1, "k")] },
    { id: "bowling", name: "Bowling shirt", rarity: "birdie", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...shortSleeves(p),
        R(5, 11, 1, 5, "a"), R(10, 11, 1, 5, "a"), R(4, 10, 3, 1, "W"), R(9, 10, 3, 1, "W"), R(7, 10, 2, 1, "S"), R(7, 11, 1, 1, "S"),
        ...DOTS([[8, 12], [8, 14]], "W"), R(6, 12, 1, 2, "W"), R(6, 12, 1, 1, "r")] },
    { id: "windbreaker", name: "Neon windbreaker", rarity: "eagle", draw: p => [R(4, 10, 8, 6, "t"), R(11, 10, 1, 6, "T"), ...longSleeves(p), ...cuffs(p, NEON_PINK),
        R(5, 9, 6, 1, "T"), R(7, 9, 2, 1, "S"), R(7, 10, 1, 4, "x"),
        ...DOTS([[4, 11], [5, 12], [6, 13], [7, 14], [8, 14], [9, 13], [10, 12], [11, 11]], NEON_PINK),
        ...DOTS([[4, 12], [5, 13], [6, 14], [7, 15], [8, 15], [9, 14], [10, 13], [11, 12]], NEON_MINT)] },
    // Lapels and bow tie take the shirt color, so the round color still shows
    { id: "tux", name: "Gold sequin tux", rarity: "albatross", draw: p => [R(4, 10, 8, 6, "g"), R(11, 10, 1, 6, "G"),
        ...p.arms.map(r => ({ ...r, t: "g" })), ...p.shoulders.map(r => ({ ...r, t: "g" })), ...cuffs(p, "W"),
        R(7, 11, 2, 5, "W"), R(5, 11, 2, 1, "t"), R(6, 12, 1, 2, "t"), R(9, 11, 2, 1, "t"), R(9, 12, 1, 2, "t"),
        R(6, 10, 4, 1, "t"), R(7, 10, 2, 1, "T"), ...DOTS([[8, 12], [8, 14]], "k"),
        ...DOTS([[4, 11], [10, 14], [5, 15]], SPARK, "px-twinkle"), ...DOTS([[11, 12], [4, 14], [10, 15]], SPARK, "px-twinkle2")] },
  ];
  const PANTS = [
    { id: "slacks", name: "Slacks", rarity: "bogey", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 5, "p"), R(9, 17, 3, 5, "p"), R(7, 17, 2, 1, "p"), R(6, 17, 1, 5, "P"), R(11, 17, 1, 5, "P")] },
    { id: "shorts", name: "Shorts", rarity: "bogey", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 2, "p"), R(9, 17, 3, 2, "p"), R(7, 17, 2, 1, "p"), R(6, 17, 1, 2, "P"), R(11, 17, 1, 2, "P")] },
    { id: "joggers", name: "Joggers", rarity: "bogey", draw: () => [R(4, 16, 8, 1, "P"), R(4, 17, 3, 5, "p"), R(9, 17, 3, 5, "p"), R(7, 17, 2, 1, "p"), R(4, 21, 3, 1, "P"), R(9, 21, 3, 1, "P"), ...DOTS([[7, 17], [8, 17]], "W")] },
    { id: "plaid", name: "Plaid", rarity: "bogey", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 5, "p"), R(9, 17, 3, 5, "p"), R(7, 17, 2, 1, "p"),
        R(4, 18, 3, 1, "q"), R(9, 18, 3, 1, "q"), R(4, 20, 3, 1, "q"), R(9, 20, 3, 1, "q"), R(5, 17, 1, 5, "q"), R(10, 17, 1, 5, "q")] },
    // Pro Shop
    { id: "cargo", name: "Cargo shorts", rarity: "par", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 3, "p"), R(9, 17, 3, 3, "p"), R(7, 17, 2, 1, "p"),
        R(6, 17, 1, 3, "P"), R(11, 17, 1, 3, "P"), R(4, 18, 2, 2, "P"), R(10, 18, 2, 2, "P"), R(4, 18, 2, 1, "q"), R(10, 18, 2, 1, "q")] },
    { id: "pastel", name: "Pastel plaid", rarity: "birdie", draw: () => [R(4, 16, 8, 1, "W"), R(7, 16, 2, 1, "y"), R(4, 17, 3, 5, "v"), R(9, 17, 3, 5, "v"), R(7, 17, 2, 1, "v"),
        R(5, 17, 1, 5, "W"), R(10, 17, 1, 5, "W"), R(4, 18, 3, 1, "V"), R(9, 18, 3, 1, "V"), R(4, 20, 3, 1, "V"), R(9, 20, 3, 1, "V")] },
    { id: "flames", name: "Flame pants", rarity: "eagle", draw: () => {
        const out = [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "x"), R(4, 17, 3, 5, "p"), R(9, 17, 3, 5, "p"), R(7, 17, 2, 1, "p"), R(6, 17, 1, 5, "P"), R(11, 17, 1, 5, "P")];
        // flames lick up from the cuffs, tallest on the outside of each leg
        [[4, 1], [9, -1]].forEach(([x, d]) => {
          const outer = d > 0 ? x : x + 2, inner = d > 0 ? x + 2 : x;
          out.push(R(x, 21, 3, 1, "#E0301E"), R(x, 20, 3, 1, "#FF7A1A"), R(x + 1, 20, 1, 1, "#FFD84D"),
            R(outer, 19, 1, 1, "#FF7A1A"), R(inner, 19, 1, 1, "#FFD84D"), R(outer, 18, 1, 1, "#FFD84D"));
        });
        return out; } },
    { id: "disco", name: "Disco bell-bottoms", rarity: "albatross", draw: () => [R(4, 16, 8, 1, "k"), R(7, 16, 2, 1, "W"), R(4, 17, 3, 5, "g"), R(9, 17, 3, 5, "g"),
        R(7, 17, 2, 1, "g"), R(6, 17, 1, 4, "G"), R(11, 17, 1, 4, "G"), R(3, 21, 4, 1, "g"), R(9, 21, 4, 1, "g"), R(3, 20, 1, 1, "g"), R(12, 20, 1, 1, "g"),
        ...DOTS([[5, 18], [11, 21]], SPARK, "px-twinkle"), ...DOTS([[10, 19], [4, 20]], SPARK, "px-twinkle2")] },
  ];
  const SHOES = [
    { id: "sneakers", name: "Sneakers", rarity: "bogey", draw: () => [R(3, 22, 4, 1, "o"), R(9, 22, 4, 1, "o"), R(3, 23, 4, 1, "n"), R(9, 23, 4, 1, "n"), R(5, 22, 1, 1, "W"), R(10, 22, 1, 1, "W")] },
    { id: "spikes", name: "Golf spikes", rarity: "bogey", draw: () => [R(3, 22, 4, 1, "W"), R(9, 22, 4, 1, "W"), R(4, 22, 2, 1, "o"), R(10, 22, 2, 1, "o"), R(3, 23, 4, 1, "k"), R(9, 23, 4, 1, "k")] },
    { id: "boots", name: "Boots", rarity: "bogey", draw: () => [R(4, 20, 3, 2, "o"), R(9, 20, 3, 2, "o"), R(3, 22, 4, 1, "o"), R(9, 22, 4, 1, "o"), R(3, 23, 4, 1, "O"), R(9, 23, 4, 1, "O")] },
    // Pro Shop
    { id: "hightops", name: "High-tops", rarity: "par", draw: () => [R(4, 20, 3, 2, "o"), R(9, 20, 3, 2, "o"), R(3, 22, 4, 1, "o"), R(9, 22, 4, 1, "o"),
        R(3, 23, 4, 1, "n"), R(9, 23, 4, 1, "n"), R(3, 22, 1, 1, "n"), R(12, 22, 1, 1, "n"), R(4, 21, 1, 1, "O"), R(11, 21, 1, 1, "O"),
        ...DOTS([[5, 20], [5, 21], [10, 20], [10, 21]], "W")] },
    { id: "wingtips", name: "Two-tone wingtips", rarity: "birdie", draw: () => [R(3, 22, 4, 1, "W"), R(9, 22, 4, 1, "W"),
        ...DOTS([[3, 22], [6, 22], [9, 22], [12, 22]], "o"), R(3, 23, 4, 1, "O"), R(9, 23, 4, 1, "O")] },
    { id: "lightup", name: "Light-up sneakers", rarity: "eagle", draw: () => [R(3, 22, 4, 1, "o"), R(9, 22, 4, 1, "o"), R(5, 22, 1, 1, "W"), R(10, 22, 1, 1, "W"),
        ...DOTS([[3, 23], [5, 23], [10, 23], [12, 23]], LASER, "px-blink"), ...DOTS([[4, 23], [6, 23], [9, 23], [11, 23]], "#FF5CA8", "px-blink2")] },
    // The grid ends at the soles, so the exhaust comes out of nozzles on the outside heels
    { id: "rocket", name: "Rocket boots", rarity: "albatross", draw: () => [R(4, 19, 3, 3, "x"), R(9, 19, 3, 3, "x"), R(6, 19, 1, 3, "#8A93A8"), R(11, 19, 1, 3, "#8A93A8"),
        R(4, 20, 3, 1, "o"), R(9, 20, 3, 1, "o"), R(3, 22, 4, 1, "x"), R(9, 22, 4, 1, "x"), R(3, 23, 4, 1, "#5B6478"), R(9, 23, 4, 1, "#5B6478"),
        R(2, 22, 1, 2, "k"), R(13, 22, 1, 2, "k"), R(1, 23, 1, 1, "#FFD84D", "px-flame"), R(14, 23, 1, 1, "#FFD84D", "px-flame"),
        R(0, 23, 1, 1, "#FF7A1A", "px-flame2"), R(15, 23, 1, 1, "#FF7A1A", "px-flame2")] },
  ];
  const HATS = [
    { id: null, name: "None", rarity: "bogey", draw: () => [] },
    { id: "cap", name: "Cap", rarity: "bogey", draw: () => [R(4, 0, 8, 3, "c"), R(4, 0, 1, 1, "_"), R(11, 0, 1, 1, "_"), R(7, 0, 2, 1, "C"), R(3, 3, 10, 1, "C")] },
    { id: "bucket", name: "Bucket hat", rarity: "bogey", draw: () => [R(5, -1, 6, 2, "c"), R(4, 1, 8, 2, "c"), R(3, 3, 10, 1, "C")] },
    { id: "visor", name: "Visor", rarity: "bogey", open: true, draw: () => [R(4, 3, 8, 1, "c"), R(3, 4, 10, 1, "C")] },
    { id: "beanie", name: "Beanie", rarity: "bogey", draw: () => [R(4, 0, 8, 3, "c"), R(4, 0, 1, 1, "_"), R(11, 0, 1, 1, "_"), R(4, 3, 8, 1, "C"), R(7, -2, 2, 2, "W")] },
    { id: "tophat", name: "Top hat", rarity: "eagle", draw: () => [R(5, -3, 6, 5, "k"), R(5, 0, 6, 1, "c"), R(3, 2, 10, 1, "k")] },
    // Pro Shop
    { id: "trucker", name: "Trucker cap", rarity: "par", draw: () => [R(4, -1, 8, 4, "c"), R(4, -1, 1, 1, "_"), R(11, -1, 1, 1, "_"), R(5, -1, 6, 3, "W"),
        R(7, 0, 2, 1, "c"), ...DOTS([[4, 1], [11, 1]], "C"), R(3, 3, 10, 1, "C")] },
    { id: "tam", name: "Pom-pom tam", rarity: "birdie", draw: () => [R(4, -1, 8, 1, "c"), R(3, 0, 10, 2, "c"), R(2, 1, 1, 1, "c"), R(13, 1, 1, 1, "c"),
        R(4, 2, 8, 1, "C"), ...DOTS([[5, 0], [9, 0], [3, 1], [7, 1], [11, 1]], "d"), R(7, -3, 2, 2, "r"), R(7, -3, 1, 1, "#FF8FA3")] },
    { id: "viking", name: "Viking helmet", rarity: "eagle", draw: () => [R(5, -2, 6, 1, "x"), R(4, -1, 8, 3, "x"), R(4, -1, 1, 1, "_"), R(11, -1, 1, 1, "_"),
        R(7, -2, 2, 4, "c"), R(9, -1, 1, 1, "W"), R(3, 2, 10, 1, "#7C869C"), ...DOTS([[4, 2], [6, 2], [9, 2], [11, 2]], "k"),
        R(2, 0, 2, 2, "#F3E6C4"), R(1, -2, 1, 2, "#F3E6C4"), R(1, -3, 1, 1, "#C9B27C"),
        R(12, 0, 2, 2, "#F3E6C4"), R(14, -2, 1, 2, "#F3E6C4"), R(14, -3, 1, 1, "#C9B27C")] },
    { id: "crown", name: "Crown", rarity: "albatross", draw: () => [R(4, 0, 8, 2, "g"), R(4, 1, 8, 1, "G"), R(4, -1, 1, 1, "g"), R(7, -2, 2, 2, "g"), R(11, -1, 1, 1, "g"), R(5, 1, 1, 1, "r"), R(10, 1, 1, 1, "r"), R(7, 0, 2, 1, "r")] },
  ];
  const ITEMS = [
    { id: null, name: "None", rarity: "bogey", draw: () => [] },
    { id: "driver", name: "Driver", rarity: "bogey", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 6, 1, 7, "x"), R(h.x + 1, h.y - 7, 2, 1, "k"), R(h.x + 2, h.y - 8, 1, 1, "k")]
        : [R(h.x + 2, h.y - 1, 1, 7, "x"), R(h.x + 2, h.y + 6, 2, 1, "k"), R(h.x + 3, h.y + 5, 1, 1, "k")] },
    { id: "putter", name: "Putter", rarity: "bogey", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 6, 1, 7, "x"), R(h.x, h.y - 7, 3, 1, "y")]
        : [R(h.x + 2, h.y - 1, 1, 7, "x"), R(h.x + 1, h.y + 6, 3, 1, "y")] },
    { id: "coffee", name: "Coffee", rarity: "bogey", draw: (p, h) => p.up
        ? [R(h.x, h.y - 3, 2, 3, "W"), R(h.x, h.y - 4, 2, 1, "k"), R(h.x, h.y - 2, 2, 1, "b")]
        : [R(h.x + 2, h.y - 2, 2, 3, "W"), R(h.x + 2, h.y - 3, 2, 1, "k"), R(h.x + 2, h.y - 1, 2, 1, "b"), R(h.x + 3, h.y - 5, 1, 1, "y"), R(h.x + 2, h.y - 6, 1, 1, "y")] },
    { id: "flag", name: "Pin flag", rarity: "bogey", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 7, 1, 9, "W"), R(h.x + 2, h.y - 7, 2, 3, "f"), R(h.x + 2, h.y - 6, 1, 1, "F")]
        : [R(h.x + 2, h.y - 13, 1, 20, "W"), R(h.x + 3, h.y - 13, 2, 3, "f"), R(h.x + 3, h.y - 12, 1, 1, "F")] },
    // Pro Shop
    { id: "umbrella", name: "Golf umbrella", rarity: "par", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 3, 1, 3, "x"), R(h.x - 2, h.y - 4, 7, 1, "f"), R(h.x - 1, h.y - 5, 5, 1, "f"), R(h.x, h.y - 6, 3, 1, "f"),
           R(h.x - 2, h.y - 3, 1, 1, "F"), R(h.x + 1, h.y - 3, 1, 1, "x"), R(h.x + 4, h.y - 3, 1, 1, "F"),
           ...DOTS([[h.x - 1, h.y - 4], [h.x + 3, h.y - 4], [h.x, h.y - 5], [h.x + 2, h.y - 5], [h.x + 1, h.y - 6]], "W")]
        : [R(h.x + 1, h.y - 1, 2, 1, "k"), R(h.x + 2, h.y, 1, 2, "x"), R(h.x + 1, h.y + 2, 3, 3, "f"), R(h.x + 2, h.y + 2, 1, 3, "W"),
           R(h.x + 2, h.y + 5, 1, 1, "f"), R(h.x + 2, h.y + 6, 1, 1, "x")] },
    // Held by the feet: raised stiff overhead, or dangling head-down
    { id: "chicken", name: "Rubber chicken", rarity: "birdie", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 1, 1, 1, BEAK), R(h.x, h.y - 4, 3, 3, CHICKEN), R(h.x + 2, h.y - 3, 1, 2, "#E0B92E"), R(h.x + 1, h.y - 5, 1, 1, CHICKEN),
           R(h.x + 1, h.y - 6, 2, 1, CHICKEN), R(h.x + 2, h.y - 6, 1, 1, "k"), R(h.x + 3, h.y - 6, 1, 1, BEAK), R(h.x, h.y - 6, 1, 1, "r")]
        : [R(h.x + 2, h.y - 1, 2, 1, BEAK), R(h.x + 2, h.y, 1, 1, BEAK), R(h.x + 1, h.y + 1, 3, 3, CHICKEN), R(h.x + 3, h.y + 2, 1, 2, "#E0B92E"),
           R(h.x + 2, h.y + 4, 1, 2, CHICKEN), R(h.x + 1, h.y + 6, 2, 1, CHICKEN), R(h.x + 1, h.y + 6, 1, 1, "k"), R(h.x + 3, h.y + 6, 1, 1, BEAK),
           R(h.x + 1, h.y + 7, 2, 1, "r")] },
    { id: "laser", name: "Laser putter", rarity: "eagle", draw: (p, h) => p.up
        ? [R(h.x + 1, h.y - 5, 1, 6, LASER, "px-glow"), R(h.x, h.y - 6, 3, 1, "k"), R(h.x + 1, h.y - 6, 1, 1, NEON_PINK, "px-glow")]
        : [R(h.x + 2, h.y - 1, 1, 7, LASER, "px-glow"), R(h.x + 1, h.y + 6, 3, 1, "k"), R(h.x + 2, h.y + 6, 1, 1, NEON_PINK, "px-glow")] },
    { id: "trophy", name: "Trophy", rarity: "albatross", draw: (p, h) => p.up
        ? [R(h.x - 1, h.y - 5, 4, 3, "g"), R(h.x - 2, h.y - 5, 1, 2, "G"), R(h.x + 3, h.y - 5, 1, 2, "G"), R(h.x, h.y - 2, 2, 1, "G"), R(h.x - 1, h.y - 1, 4, 1, "b")]
        : [R(h.x + 2, h.y - 4, 3, 3, "g"), R(h.x + 2, h.y - 1, 3, 1, "G"), R(h.x + 3, h.y, 1, 1, "G"), R(h.x + 2, h.y + 1, 3, 1, "b")] },
  ];
  // Every piece has a rarity; anything above Bogey is sold in the Pro Shop (see outfitOwned in outfits.js)
  [HAIR, FACE, SHIRTS, PANTS, SHOES, HATS, ITEMS].forEach(list => list.forEach(it => { it.rarity = it.rarity || "bogey"; }));

  const DEFAULT = { skin: SKINS[1], eyes: EYES[0], hair: "short", hairColor: HAIRC[1], face: "none",
    shirt: "polo", shirtColor: CLOTH[0], pants: "slacks", pantsColor: CLOTH[10], shoes: "spikes", shoeColor: CLOTH[2],
    hat: "cap", hatColor: CLOTH[7], item: "driver" };

  function render(o, poseName = "idle") {
    const p = POSES[poseName] || POSES.idle;
    const grid = Array.from({ length: H }, () => Array(W).fill(null));
    const fx = Array.from({ length: H }, () => Array(W).fill(null)); // CSS class per pixel, for animated ones
    const clothAccent = c => lum(c) > 0.6 ? "#1F3B73" : tint(c, 0.65);
    const pal = {
      s: o.skin, S: shade(o.skin, 0.86), m: shade(o.skin, 0.62), L: tint(o.skin, 0.45),
      h: o.hairColor, H: shade(o.hairColor, 0.72), e: o.eyes,
      t: o.shirtColor, T: shade(o.shirtColor), a: clothAccent(o.shirtColor), y: "#FFD84D",
      p: o.pantsColor, P: shade(o.pantsColor), q: clothAccent(o.pantsColor),
      o: o.shoeColor, O: shade(o.shoeColor, 0.6), n: "#E6EAF2",
      c: o.hatColor, C: shade(o.hatColor), d: clothAccent(o.hatColor), v: tint(o.pantsColor, 0.55), V: tint(o.pantsColor, 0.25),
      g: "#FFD84D", G: "#C99A1E", r: "#FF3B5C", k: "#1A1C26", W: "#F2F5FA", x: "#B8C2D6", b: "#7A4A2A", f: "#FF3B5C", F: "#C21F3C",
    };
    const put = list => list.forEach(r => {
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) {
        const gx = xx + OX, gy = yy + OY;
        if (gx < 1 || gy < 1 || gx >= W - 1 || gy >= H - 1) continue;
        grid[gy][gx] = r.t === "_" ? null : (pal[r.t] || r.t);
        fx[gy][gx] = r.t === "_" ? null : r.cls || null;
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
    // Hide hair down to the hat's lowest row (its brim), so none pokes out beside the crown. Open-top hats (visor)
    // only trim the top row.
    if (o.hat) {
      const hat = find(HATS, o.hat);
      const top = hat.open ? 0 : Math.max(...hat.draw(p).map(r => r.y + r.h - 1));
      hair = hair.map(r => {
        const y0 = Math.max(r.y, top + 1);
        return y0 < r.y + r.h ? { ...r, y: y0, h: r.y + r.h - y0 } : null;
      }).filter(Boolean);
    }
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
        const c = out[y][x], f = fx[y][x];
        if (!c) { x++; continue; }
        let x2 = x + 1;
        while (x2 < W && out[y][x2] === c && fx[y][x2] === f) x2++;
        rects += '<rect' + (f ? ' class="' + f + '"' : "") + ' x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" fill="' + c + '"/>';
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

  return { W, H, RARITY, SKINS, EYES, HAIRC, CLOTH, HAIR, FACE, SHIRTS, PANTS, SHOES, HATS, ITEMS, DEFAULT, POSES, render, svg };
})();
