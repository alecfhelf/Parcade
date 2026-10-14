// ---------- Character outfits ----------
// Every item draws on the stick figure's 24x24 grid (see figureEl in app.js): head at 12,5 (r3), neck 12,8,
// arms from 12,11 to the hands at 7,9 and 17,9, hips at 12,15, feet at 8,21 and 16,21. Items are held in the
// hand at 17,9. Layers: shoes, body, pants, shirt, hat, item (pants sit over the leg lines so they read as pants).
// Fixed colors are listed in OUTFIT_COLORS so light mode can darken them (injectThemeCSS).
const OUTFIT_SLOTS = ["color", "hat", "shirt", "pants", "shoes", "item"];
const OUTFIT_COLORS = ["#E6C3A1", "#C9A24A", "#8A6A4A", "#F2F5FA", "#1B1030", "#C9D3E8", "#E8EEF8", "#7A4FD1",
  "#FFD84D", "#FF7A3D", "#FFF3B0", "#D9DEE8", "#C9B27C", "#3FA35B", "#5B7FD1", "#B0895A", "#6B4A2E", "#FF5C7A",
  "#2B3245", "#EAF2FF", "#F3E6C4"];

const OUTFIT_ITEMS = [
  // Hats
  { id: "hat-bucket", slot: "hat", name: "Bucket hat", rarity: "common", price: null,
    svg: () => '<path d="M9.4 3.4Q9.4 0.4 12 0.4Q14.6 0.4 14.6 3.4Z" fill="#E6C3A1" stroke="#C9A24A" stroke-width="0.6"/>' +
      '<path d="M7.6 4.4Q12 2.2 16.4 4.4" stroke="#C9A24A" stroke-width="1.3"/>' },
  { id: "hat-flatcap", slot: "hat", name: "Flat cap", rarity: "common", price: null,
    svg: () => '<path d="M9 3.6Q9 0.8 12 0.8Q14.6 0.8 15.2 3L17.8 3.7Q16.4 4.3 9 3.6Z" fill="#8A6A4A" stroke="#C9A24A" stroke-width="0.6"/>' },
  { id: "hat-visor", slot: "hat", name: "Visor", rarity: "common", price: null,
    svg: c => '<path d="M9.2 2.8H14.8" stroke="' + c + '" stroke-width="1.3"/>' +
      '<path d="M14.2 2.9Q17 2.6 18.2 3.8" stroke="#F2F5FA" stroke-width="1.5"/>' },
  { id: "hat-top", slot: "hat", name: "Top hat", rarity: "epic", price: null,
    svg: c => '<rect x="9.6" y="-3.4" width="4.8" height="5.8" rx="0.4" fill="#1B1030" stroke="#C9D3E8" stroke-width="0.6"/>' +
      '<path d="M9.8 1.2H14.2" stroke="' + c + '" stroke-width="1"/>' +
      '<path d="M7.8 2.6H16.2" stroke="#C9D3E8" stroke-width="1.2"/>' },
  // Shirts
  { id: "shirt-polo", slot: "shirt", name: "Polo", rarity: "common", price: null,
    svg: c => '<path d="M9.4 8.6H14.6L16.4 9.4L15.6 11.2L14.6 10.8V15.4H9.4V10.8L8.4 11.2L7.6 9.4Z" fill="#E8EEF8"/>' +
      '<path d="M10.6 8.6L12 10.2L13.4 8.6" stroke="' + c + '" stroke-width="0.9"/>' },
  { id: "shirt-argyle", slot: "shirt", name: "Argyle sweater vest", rarity: "rare", price: null,
    svg: () => '<path d="M9.6 8.6H10.8L12 10.4L13.2 8.6H14.4V15.4H9.6Z" fill="#7A4FD1"/>' +
      '<path d="M9.8 13L11 11.4L12.2 13L11 14.6ZM11.8 13L13 11.4L14.2 13L13 14.6Z" fill="none" stroke="#FFD84D" stroke-width="0.5"/>' },
  { id: "shirt-hawaiian", slot: "shirt", name: "Hawaiian shirt", rarity: "rare", price: null,
    svg: () => '<path d="M9.4 8.6H14.6L16.4 9.4L15.6 11.2L14.6 10.8V15.4H9.4V10.8L8.4 11.2L7.6 9.4Z" fill="#FF7A3D"/>' +
      '<circle cx="10.6" cy="11.4" r="0.8" fill="#FFF3B0"/><circle cx="13.4" cy="13.4" r="0.8" fill="#FFF3B0"/>' +
      '<circle cx="11.2" cy="14.4" r="0.5" fill="#FFF3B0"/><circle cx="13.6" cy="10.2" r="0.5" fill="#FFF3B0"/>' },
  { id: "shirt-tee", slot: "shirt", name: "Striped tee", rarity: "common", price: null,
    svg: c => '<path d="M9.4 8.6H14.6L16.4 9.4L15.6 11.2L14.6 10.8V15.4H9.4V10.8L8.4 11.2L7.6 9.4Z" fill="#D9DEE8"/>' +
      '<path d="M9.4 12.4H14.6" stroke="' + c + '" stroke-width="1.2"/>' },
  // Pants
  { id: "pants-khakis", slot: "pants", name: "Khakis", rarity: "common", price: null,
    svg: () => '<path d="M9.6 14.6H14.4L16.9 20.4L14.9 20.9L12 16.6L9.1 20.9L7.1 20.4Z" fill="#C9B27C"/>' },
  { id: "pants-plaid", slot: "pants", name: "Plaid golf pants", rarity: "rare", price: null,
    svg: () => '<path d="M9.6 14.6H14.4L16.9 20.4L14.9 20.9L12 16.6L9.1 20.9L7.1 20.4Z" fill="#3FA35B"/>' +
      '<path d="M9.2 16.2H14.8M8.3 18.4H10.6M13.4 18.4H15.7M10.6 14.6L8.6 20.6M13.4 14.6L15.4 20.6" stroke="#FFD84D" stroke-width="0.45"/>' },
  { id: "pants-shorts", slot: "pants", name: "Shorts", rarity: "common", price: null,
    svg: () => '<path d="M9.6 14.6H14.4L15.7 18.2L13.7 18.7L12 16.6L10.3 18.7L8.3 18.2Z" fill="#5B7FD1"/>' },
  { id: "pants-knickers", slot: "pants", name: "Knickers and long socks", rarity: "epic", price: null,
    svg: () => '<path d="M10.1 18.4L8.3 20.8M13.9 18.4L15.7 20.8" stroke="#E8EEF8" stroke-width="2.4"/>' +
      '<path d="M9.6 19.4L9.2 19.9M14.4 19.4L14.8 19.9" stroke="#FF5C7A" stroke-width="2.6"/>' +
      '<path d="M9.6 14.6H14.4L15.9 18.4L13.8 19L12 16.6L10.2 19L8.1 18.4Z" fill="#B0895A"/>' },
  // Shoes
  { id: "shoes-spikes", slot: "shoes", name: "Golf spikes", rarity: "common", price: null,
    svg: () => '<path d="M9 20.6L6 21.2Q5.4 22.4 6.6 22.4H9.2ZM15 20.6L18 21.2Q18.6 22.4 17.4 22.4H14.8Z" fill="#F2F5FA"/>' +
      '<path d="M6.6 23V23.3M8.4 23V23.3M15.6 23V23.3M17.4 23V23.3" stroke="#C9D3E8" stroke-width="0.6"/>' },
  { id: "shoes-saddle", slot: "shoes", name: "Two-tone saddles", rarity: "rare", price: null,
    svg: () => '<path d="M9 20.6L6 21.2Q5.4 22.4 6.6 22.4H9.2ZM15 20.6L18 21.2Q18.6 22.4 17.4 22.4H14.8Z" fill="#F2F5FA"/>' +
      '<path d="M7.2 20.9V22.4H8.6V20.7ZM16.8 20.9V22.4H15.4V20.7Z" fill="#6B4A2E"/>' },
  { id: "shoes-sneakers", slot: "shoes", name: "Sneakers", rarity: "common", price: null,
    svg: () => '<path d="M9 20.4L6 21Q5.4 22.4 6.6 22.4H9.2ZM15 20.4L18 21Q18.6 22.4 17.4 22.4H14.8Z" fill="#FF5C7A"/>' +
      '<path d="M5.8 22.4H9.2M14.8 22.4H18.2" stroke="#F2F5FA" stroke-width="0.7"/>' },
  // Items (right hand, 17,9)
  { id: "item-driver", slot: "item", name: "Driver", rarity: "common", price: null,
    svg: () => '<path d="M17 9.4L21.6 1.6" stroke="#C9D3E8" stroke-width="0.8"/><path d="M16.8 9.8L17.9 7.9" stroke="#2B3245" stroke-width="1.3"/>' +
      '<path d="M20.8 1.4Q23 -0.2 23.8 1.2Q24 2.8 21.8 2.6Z" fill="#2B3245" stroke="#C9D3E8" stroke-width="0.6"/>' },
  { id: "item-putter", slot: "item", name: "Putter", rarity: "common", price: null,
    svg: () => '<path d="M17 8.6L19.6 21.4" stroke="#C9D3E8" stroke-width="0.8"/><path d="M16.8 8L17.3 10.4" stroke="#2B3245" stroke-width="1.3"/>' +
      '<path d="M18.8 21.6H22.4" stroke="#C9D3E8" stroke-width="1.6"/>' },
  { id: "item-flag", slot: "item", name: "Flag on a pole", rarity: "rare", price: null,
    svg: () => '<path d="M17.4 11.2V-1" stroke="#EAF2FF" stroke-width="0.8"/><path d="M17.4 -1L22.4 0.8L17.4 2.6Z" fill="#FF5C7A"/>' },
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

// Old or bad data never breaks rendering: unknown ids and wrong slots drop to none, color falls back to default
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

// SVG strings for each layer of an outfit. Small figures (chat, scorecards) only get the hat and item.
function outfitLayers(outfit, c, small) {
  const fit = normalizeOutfit(outfit);
  const draw = slot => {
    const it = fit[slot] && OUTFIT_BY_ID.get(fit[slot]);
    if (!it || (small && (slot === "shirt" || slot === "pants" || slot === "shoes"))) return "";
    return '<g class="fit-' + slot + '" stroke="none">' + it.svg(c) + "</g>";
  };
  return { pants: draw("pants"), shoes: draw("shoes"), shirt: draw("shirt"), hat: draw("hat"), item: draw("item") };
}
