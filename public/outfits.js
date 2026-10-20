// ---------- Character outfits (v2: pixel characters, drawn by sprites.js) ----------
// { v: 2, skin, eyes, hair, hairColor, face, shirt, shirtColor, pants, pantsColor, shoes, shoeColor, hat, hatColor, item }
// Stored in auth user_metadata.outfit (accounts) or localStorage (guests) and copied to players.outfit when a player
// row is created; players.color is the shirt color for that round.

// Style slots and the wardrobe list each one picks from
const OUTFIT_SLOTS = { hair: PX.HAIR, face: PX.FACE, shirt: PX.SHIRTS, pants: PX.PANTS, shoes: PX.SHOES, hat: PX.HATS, item: PX.ITEMS };
// Color fields and the swatches the dressing room offers for each
const OUTFIT_COLOR_FIELDS = { skin: PX.SKINS, eyes: PX.EYES, hairColor: PX.HAIRC, shirtColor: PX.CLOTH, pantsColor: PX.CLOTH, shoeColor: PX.CLOTH, hatColor: PX.CLOTH };

const DEFAULT_OUTFIT = { v: 2, ...PX.DEFAULT };

// Everything is free for now (price null). When the store ships, this checks the user's user_items rows
// (and the token balance for buying) instead of returning true. Keep the signature: the dressing room calls it.
function outfitOwned(id, user) {
  return true;
}

const isHex = c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

// v1 ids (vector stick figure outfits) to the closest v2 pieces, with a color where the old piece had a fixed one
const OUTFIT_V1 = {
  shirt: { "shirt-polo": ["polo"], "shirt-tee": ["tee"], "shirt-argyle": ["argyle"], "shirt-hawaiian": ["hawaii"] },
  pants: { "pants-khakis": ["slacks", "#C8A27A"], "pants-plaid": ["plaid", "#3CCB6A"], "pants-shorts": ["shorts"] },
  shoes: { "shoes-spikes": ["spikes"], "shoes-saddle": ["spikes"], "shoes-sneakers": ["sneakers"] },
  hat: { "hat-bucket": ["bucket", "#C8A27A"], "hat-flatcap": ["cap", "#C8A27A"], "hat-visor": ["visor"], "hat-top": ["tophat"], "hat-crown": ["crown"] },
  item: { "item-driver": ["driver"], "item-putter": ["putter"], "item-flag": ["flag"], "item-coffee": ["coffee"] },
};
const OUTFIT_COLOR_OF = { pants: "pantsColor", hat: "hatColor", shoes: "shoeColor" };

// Old or bad data never breaks rendering: v1 outfits are migrated, unknown ids and bad colors fall back to DEFAULT_OUTFIT.
// Hat and item may be null (none); every other slot always has a piece.
function normalizeOutfit(o) {
  const out = { ...DEFAULT_OUTFIT };
  if (!o || typeof o !== "object") return out;
  const has = (slot, id) => OUTFIT_SLOTS[slot].some(it => it.id === id);
  if (o.v === 2) {
    Object.keys(OUTFIT_SLOTS).forEach(slot => { if (has(slot, o[slot])) out[slot] = o[slot]; });
    Object.keys(OUTFIT_COLOR_FIELDS).forEach(k => { if (isHex(o[k])) out[k] = o[k]; });
    // Rows filled by the players_fill_outfit trigger carry the round color in "color"
    if (isHex(o.color)) out.shirtColor = o.color;
    return out;
  }
  // v1: { color, hat, shirt, pants, shoes, item }
  if (isHex(o.color)) out.shirtColor = o.color;
  Object.keys(OUTFIT_V1).forEach(slot => {
    const m = o[slot] == null ? null : OUTFIT_V1[slot][o[slot]];
    if (m) {
      out[slot] = m[0];
      if (m[1] && OUTFIT_COLOR_OF[slot]) out[OUTFIT_COLOR_OF[slot]] = m[1];
    } else if (o[slot] == null && (slot === "hat" || slot === "item")) out[slot] = null;
  });
  return out;
}

// The outfit to draw for a figure: its own (or DEFAULT_OUTFIT when it has none) in the round's color, when there is one
function outfitFor(color, outfit) {
  const o = normalizeOutfit(outfit);
  if (isHex(color)) o.shirtColor = color;
  return o;
}
