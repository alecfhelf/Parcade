// ---------- Character outfits ----------
// Shirts, pants and shoes are built from the pose they are drawn on (see OUTFIT_POSE), so they follow the figure's
// own torso, arm and leg lines in every pose. Hats are drawn on a 24 grid head at 12,5 (r3) and items on a 24 grid
// hand at 17,9; outfitLayers moves and scales them onto the pose's head and hand.
// Fixed colors are listed in OUTFIT_COLORS so light mode can darken them (injectThemeCSS).
const OUTFIT_SLOTS = ["color", "hat", "shirt", "pants", "shoes", "item"];
const OUTFIT_COLORS = ["#E6C3A1", "#C9A24A", "#8A6A4A", "#F2F5FA", "#1B1030", "#C9D3E8", "#E8EEF8", "#7A4FD1",
  "#FFD84D", "#FF7A3D", "#FFF3B0", "#D9DEE8", "#C9B27C", "#3FA35B", "#5B7FD1", "#6B4A2E", "#FF5C7A",
  "#2B3245", "#EAF2FF", "#F3E6C4"];

// The figureEl pose (24 grid): head 12,5 r3, neck 12,8, arms from the shoulder 12,11 to the hands at 7,9 and 17,9,
// hips at 12,15, feet at 8,21 and 16,21. sw is the body stroke width; k scales hats, shoes and items; tw is the
// shirt's half width; u scales shirt details. Other poses (the podium) pass their own.
const OUTFIT_POSE = { head: [12, 5, 3], neck: [12, 8], shoulder: [12, 11], arms: [[7, 9], [17, 9]], hand: [17, 9],
  hip: [12, 15], feet: [[8, 21], [16, 21]], sw: 2.2, k: 1, tw: 2.6, u: 1 };

const n2 = v => Math.round(v * 100) / 100;
const pt = p => n2(p[0]) + " " + n2(p[1]);

// Shirt torso box: P(fx, fy) is a point by fraction of its width and height
function shirtFrame(pose) {
  const { neck, hip, tw, u } = pose;
  const x0 = neck[0] - tw, x1 = neck[0] + tw, top = neck[1] + 0.6 * u, bot = hip[1] + 0.5 * u;
  return { x0, x1, top, bot, u, cx: neck[0], P: (fx, fy) => [x0 + fx * (x1 - x0), top + fy * (bot - top)] };
}
function shirtTorso(T, fill, vneck) {
  const s = 0.9 * T.u, d = [];
  d.push([T.x0 + s, T.top]);
  if (vneck) d.push([T.cx - 1.2 * T.u, T.top], [T.cx, T.top + 2.2 * T.u], [T.cx + 1.2 * T.u, T.top]);
  d.push([T.x1 - s, T.top], [T.x1, T.top + s], [T.x1, T.bot], [T.x0, T.bot], [T.x0, T.top + s]);
  return '<path d="M' + d.map(pt).join("L") + 'Z" fill="' + fill + '"/>';
}
// One sleeve along an arm's first segment, from the shoulder until just past the side of the shirt
function shirtSleeve(pose, end, fill) {
  const [sx, sy] = pose.shoulder, dx = end[0] - sx, dy = end[1] - sy, len = Math.hypot(dx, dy);
  if (!len) return "";
  const ux = dx / len, uy = dy / len;
  const reach = Math.min(len * 0.8, pose.tw / Math.max(Math.abs(ux), 0.3) + 1.1 * pose.u);
  return '<path d="M' + pt([sx, sy]) + "L" + pt([sx + ux * reach, sy + uy * reach]) + '" stroke="' + fill +
    '" stroke-width="' + n2(pose.sw * 1.5) + '" stroke-linecap="butt"/>';
}
// Leg helpers for pants: L(i, t) is the point t of the way from the hip to foot i
function pantsLegs(pose) {
  const { hip, feet, sw } = pose;
  const L = (i, t) => [hip[0] + (feet[i][0] - hip[0]) * t, hip[1] + (feet[i][1] - hip[1]) * t];
  const across = (i, t, half) => {
    const dx = feet[i][0] - hip[0], dy = feet[i][1] - hip[1], len = Math.hypot(dx, dy), p = L(i, t);
    return [[p[0] - dy / len * half, p[1] + dx / len * half], [p[0] + dy / len * half, p[1] - dx / len * half]];
  };
  // Full length runs just past each foot so the leg's round end is covered too
  const full = i => 1 + sw * 0.55 / Math.hypot(feet[i][0] - hip[0], feet[i][1] - hip[1]);
  return { L, across, full, w: sw * 1.65, hip, sw };
}
// len 1 is full length pants, less is shorts
function pantsBase(G, fill, len) {
  const w = G.w, end = i => G.L(i, len === 1 ? G.full(i) : len);
  return '<path d="M' + pt(end(0)) + "L" + pt(G.hip) + "L" + pt(end(1)) + '" stroke="' + fill + '" stroke-width="' +
    n2(w) + '" stroke-linecap="butt" stroke-linejoin="round"/>' +
    '<rect x="' + n2(G.hip[0] - w * 0.65) + '" y="' + n2(G.hip[1] - w * 0.5) + '" width="' + n2(w * 1.3) + '" height="' +
    n2(w * 0.75) + '" rx="' + n2(w * 0.15) + '" fill="' + fill + '"/>';
}
// Shoe for the left foot with the foot at 0,0 (the right foot is mirrored)
// It reaches far enough down and back to cover the hem of full length pants.
const SHOE = "M1.4 -0.9L-1.3 -0.5Q-2.7 -0.2 -2.7 0.9Q-2.7 2.05 -2 2.05H1.4Q2.05 2.05 2.05 1.4V-0.3Q2.05 -0.9 1.4 -0.9Z";

const OUTFIT_ITEMS = [
  // Hats (head at 12,5 r3)
  { id: "hat-bucket", slot: "hat", name: "Bucket hat", rarity: "common", price: null,
    svg: () => '<path d="M9.2 3.6Q9.2 0.3 12 0.3Q14.8 0.3 14.8 3.6Z" fill="#E6C3A1" stroke="#C9A24A" stroke-width="0.6"/>' +
      '<path d="M7.4 4.4Q12 2.4 16.6 4.4" stroke="#C9A24A" stroke-width="1.3"/>' },
  { id: "hat-flatcap", slot: "hat", name: "Flat cap", rarity: "common", price: null,
    svg: () => '<path d="M8.8 3.8Q8.8 0.5 12 0.5Q14.7 0.5 15.3 3L17.8 3.8Q16.4 4.4 8.8 3.8Z" fill="#8A6A4A" stroke="#C9A24A" stroke-width="0.6"/>' },
  { id: "hat-visor", slot: "hat", name: "Visor", rarity: "common", price: null,
    svg: () => '<path d="M8.6 3.6Q12 1.6 15.2 3.2" stroke="#F2F5FA" stroke-width="1.3"/>' +
      '<path d="M14.4 3Q17.2 2.6 18.4 3.9" stroke="#F2F5FA" stroke-width="1.6"/>' },
  { id: "hat-top", slot: "hat", name: "Top hat", rarity: "epic", price: null,
    svg: c => '<rect x="9.6" y="-1.4" width="4.8" height="4.6" rx="0.4" fill="#1B1030" stroke="#C9D3E8" stroke-width="0.6"/>' +
      '<path d="M9.8 2H14.2" stroke="' + c + '" stroke-width="1"/>' +
      '<path d="M7.8 3.4H16.2" stroke="#C9D3E8" stroke-width="1.2"/>' },
  { id: "hat-crown", slot: "hat", name: "Crown", rarity: "legendary", price: null,
    svg: () => '<path d="M8.7 3.7L8.9 0.2L10.6 1.9L12 -0.9L13.4 1.9L15.1 0.2L15.3 3.7Z" fill="#FFD84D" stroke="#C9A24A" stroke-width="0.5" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="2.7" r="0.6" fill="#FF5C7A"/>' },
  // Shirts: svg(c, pose) builds the shirt from the pose's torso and arms. Shirts, pants and shoes also have a solid
  // fill (and pants a len) that small figures use in place of svg.
  { id: "shirt-polo", slot: "shirt", name: "Polo", rarity: "common", price: null, sleeves: "#E8EEF8", fill: "#E8EEF8",
    svg: (c, pose) => { const T = shirtFrame(pose);
      return shirtTorso(T, "#E8EEF8") + '<path d="M' + pt([T.cx - 1.3 * T.u, T.top]) + "L" + pt([T.cx, T.top + 1.6 * T.u]) + "L" +
        pt([T.cx + 1.3 * T.u, T.top]) + '" stroke="' + c + '" stroke-width="' + n2(0.9 * T.u) + '"/>'; } },
  { id: "shirt-argyle", slot: "shirt", name: "Argyle sweater vest", rarity: "rare", price: null, sleeves: null, fill: "#7A4FD1",
    svg: (c, pose) => { const T = shirtFrame(pose), hw = (T.x1 - T.x0) * 0.22, hh = (T.bot - T.top) * 0.2;
      const dia = fx => { const [x, y] = T.P(fx, 0.64); return "M" + pt([x - hw, y]) + "L" + pt([x, y - hh]) + "L" + pt([x + hw, y]) + "L" + pt([x, y + hh]) + "Z"; };
      return shirtTorso(T, "#7A4FD1", true) + '<path d="' + dia(0.27) + dia(0.73) + '" fill="none" stroke="#FFD84D" stroke-width="' + n2(0.5 * T.u) + '"/>'; } },
  { id: "shirt-hawaiian", slot: "shirt", name: "Hawaiian shirt", rarity: "rare", price: null, sleeves: "#FF7A3D", fill: "#FF7A3D",
    svg: (c, pose) => { const T = shirtFrame(pose);
      return shirtTorso(T, "#FF7A3D") + [[0.25, 0.4, 0.8], [0.75, 0.68, 0.8], [0.35, 0.85, 0.5], [0.78, 0.2, 0.5]].map(([fx, fy, r]) => {
        const [x, y] = T.P(fx, fy); return '<circle cx="' + n2(x) + '" cy="' + n2(y) + '" r="' + n2(r * T.u) + '" fill="#FFF3B0"/>'; }).join(""); } },
  { id: "shirt-tee", slot: "shirt", name: "Striped tee", rarity: "common", price: null, sleeves: "#D9DEE8", fill: "#D9DEE8",
    svg: (c, pose) => { const T = shirtFrame(pose);
      return shirtTorso(T, "#D9DEE8") + '<path d="M' + pt(T.P(0, 0.45)) + "H" + n2(T.x1) + "M" + pt(T.P(0, 0.75)) + "H" + n2(T.x1) +
        '" stroke="' + c + '" stroke-width="' + n2(0.8 * T.u) + '"/>'; } },
  // Pants: svg(c, pose) builds the pants along the pose's leg lines
  { id: "pants-khakis", slot: "pants", name: "Khakis", rarity: "common", price: null, fill: "#C9B27C", len: 1,
    svg: (c, pose) => pantsBase(pantsLegs(pose), "#C9B27C", 1) },
  { id: "pants-plaid", slot: "pants", name: "Plaid golf pants", rarity: "rare", price: null, fill: "#3FA35B", len: 1,
    svg: (c, pose) => { const G = pantsLegs(pose), lw = n2(G.sw * 0.2);
      const lines = [0, 1].map(i => "M" + pt(G.L(i, 0.08)) + "L" + pt(G.L(i, G.full(i))) +
        [0.4, 0.72].map(t => { const [a, b] = G.across(i, t, G.w / 2); return "M" + pt(a) + "L" + pt(b); }).join("")).join("");
      return pantsBase(G, "#3FA35B", 1) + '<path d="' + lines + '" stroke="#FFD84D" stroke-width="' + lw + '" stroke-linecap="butt"/>'; } },
  { id: "pants-shorts", slot: "pants", name: "Shorts", rarity: "common", price: null, fill: "#5B7FD1", len: 0.5,
    svg: (c, pose) => pantsBase(pantsLegs(pose), "#5B7FD1", 0.5) },
  // Shoes: svg() is one shoe for the left foot at 0,0, mirrored for the right
  { id: "shoes-spikes", slot: "shoes", name: "Golf spikes", rarity: "common", price: null, fill: "#F2F5FA",
    svg: () => '<path d="' + SHOE + '" fill="#F2F5FA"/><path d="M-1.8 2.45V2.85M-0.3 2.45V2.85M1.2 2.45V2.85" stroke="#C9D3E8" stroke-width="0.6"/>' },
  { id: "shoes-saddle", slot: "shoes", name: "Two-tone saddles", rarity: "rare", price: null, fill: "#6B4A2E",
    svg: () => '<path d="' + SHOE + '" fill="#F2F5FA"/><path d="M-1.1 -0.45L0.6 -0.68V2.05H-1.1Z" fill="#6B4A2E"/>' },
  { id: "shoes-sneakers", slot: "shoes", name: "Sneakers", rarity: "common", price: null, fill: "#FF5C7A",
    svg: () => '<path d="' + SHOE + '" fill="#FF5C7A"/><path d="M-2.5 2.05H1.85" stroke="#F2F5FA" stroke-width="0.7"/>' },
  // Items (held in the hand at 17,9). raise and drag are degrees to turn the item about the hand for a pose with
  // aim "raise" (held up like the podium sword) or "drag" (hanging from a limp hand)
  { id: "item-driver", slot: "item", name: "Driver", rarity: "common", price: null, raise: -8, drag: 130,
    svg: () => '<path d="M17 9.4L21.2 2.4" stroke="#C9D3E8" stroke-width="0.8"/><path d="M16.8 9.8L17.9 7.9" stroke="#2B3245" stroke-width="1.3"/>' +
      '<path d="M20.4 2.2Q22.6 0.6 23.4 2Q23.6 3.6 21.4 3.4Z" fill="#2B3245" stroke="#C9D3E8" stroke-width="0.6"/>' },
  { id: "item-putter", slot: "item", name: "Putter", rarity: "common", price: null, raise: -145, drag: -12,
    svg: () => '<path d="M17 8.6L19.6 21.4" stroke="#C9D3E8" stroke-width="0.8"/><path d="M16.8 8L17.3 10.4" stroke="#2B3245" stroke-width="1.3"/>' +
      '<path d="M18.8 21.6H22.4" stroke="#C9D3E8" stroke-width="1.6"/>' },
  { id: "item-flag", slot: "item", name: "Flag on a pole", rarity: "rare", price: null, raise: 18, drag: 150,
    svg: () => '<path d="M17.4 11.6V1" stroke="#EAF2FF" stroke-width="0.9"/><path d="M17.4 1L22 2.7L17.4 4.4Z" fill="#FF5C7A"/>' },
  { id: "item-coffee", slot: "item", name: "Coffee", rarity: "common", price: null,
    svg: c => '<path d="M16 8.2H19.6L19.1 11.6H16.5Z" fill="#F3E6C4"/><path d="M16.2 9.6H19.4" stroke="' + c + '" stroke-width="1"/>' +
      '<path d="M17.2 7.2Q16.6 6.2 17.2 5.2M18.6 7.2Q18 6.2 18.6 5.2" stroke="#C9D3E8" stroke-width="0.5"/>' },
];
const OUTFIT_BY_ID = new Map(OUTFIT_ITEMS.map(it => [it.id, it]));

// Plain stick figure in the first palette color (PALETTE[0], defined in app.js)
const DEFAULT_OUTFIT = { color: "#5CE1FF", hat: null, shirt: null, pants: null, shoes: null, item: null };

// Everything is free for now (price null). When the store ships, this checks the user's user_items rows
// (and the token balance for buying) instead of returning true. Keep the signature: the dressing room and
// normalizeOutfit already call it.
function outfitOwned(id, user) {
  const it = OUTFIT_BY_ID.get(id);
  return !!it && it.price == null;
}

// Old or bad data never breaks rendering: unknown ids (including retired ones like the knickers) and wrong slots
// drop to none, color falls back to default
function normalizeOutfit(o) {
  const out = { ...DEFAULT_OUTFIT };
  if (!o || typeof o !== "object") return out;
  const colorOk = typeof o.color === "string" && (typeof PALETTE === "undefined" || PALETTE.some(p => p[0] === o.color));
  if (colorOk) out.color = o.color;
  OUTFIT_SLOTS.slice(1).forEach(slot => {
    const it = OUTFIT_BY_ID.get(o[slot]);
    out[slot] = it && it.slot === slot ? it.id : null;
  });
  return out;
}

// SVG strings for each layer of an outfit on a pose (OUTFIT_POSE by default). Small figures (chat, scorecards)
// get every slot, but shirts, pants and shoes are drawn as solid shapes in their fill so they read at 16-24px.
// Sleeves come separately (sleeves[0] left, [1] right) so a pose whose arms animate can put each one inside its
// arm's group; shirt is the torso, drawn over the sleeves. pose.hand null means no item, pose.tilt tips the hat
// with the head, pose.aim turns the item (see OUTFIT_ITEMS), pose.arms null means no sleeves.
function outfitLayers(outfit, c, small, pose = OUTFIT_POSE) {
  const fit = normalizeOutfit(outfit);
  const get = slot => (fit[slot] && OUTFIT_BY_ID.get(fit[slot])) || null;
  const wrap = (slot, inner, tf) => inner ? '<g class="fit-' + slot + '" stroke="none"' + (tf ? ' transform="' + tf + '"' : "") + ">" + inner + "</g>" : "";
  const L = { pants: "", shoes: "", shirt: "", hat: "", item: "", sleeves: ["", ""] };
  const hat = get("hat"), shirt = get("shirt"), pants = get("pants"), shoes = get("shoes"), item = get("item");
  if (hat && pose.head) {
    const [hx, hy, r] = pose.head, s = r / 3;
    L.hat = wrap("hat", hat.svg(c), "translate(" + n2(hx - 12 * s) + " " + n2(hy - 5 * s) + ") scale(" + n2(s) + ")" +
      (pose.tilt ? " rotate(" + pose.tilt + " 12 5)" : ""));
  }
  if (item && pose.hand) {
    const k = pose.k, turn = (pose.aim && item[pose.aim]) || 0, tf = [];
    if (pose.hand[0] !== 17 || pose.hand[1] !== 9 || k !== 1) tf.push("translate(" + n2(pose.hand[0] - 17 * k) + " " + n2(pose.hand[1] - 9 * k) + ") scale(" + n2(k) + ")");
    if (turn) tf.push("rotate(" + turn + " 17 9)");
    L.item = wrap("item", item.svg(c), tf.join(" "));
  }
  if (shoes && pose.feet) {
    const shoe = small ? '<path d="' + SHOE + '" fill="' + shoes.fill + '"/>' : shoes.svg(c);
    L.shoes = pose.feet.map((f, i) => wrap("shoes", shoe, "translate(" + pt(f) + ") scale(" + (i ? -pose.k : pose.k) + " " + pose.k + ")")).join("");
  }
  if (pants && pose.feet) L.pants = wrap("pants", small ? pantsBase(pantsLegs(pose), pants.fill, pants.len) : pants.svg(c, pose));
  if (shirt && pose.neck) {
    L.shirt = wrap("shirt", small ? shirtTorso(shirtFrame(pose), shirt.fill) : shirt.svg(c, pose));
    if (shirt.sleeves && pose.arms) L.sleeves = pose.arms.map(end => wrap("shirt", shirtSleeve(pose, end, shirt.sleeves)));
  }
  return L;
}
