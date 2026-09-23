// ---------- Cart Caddy ----------
const CADDY_CARDS = [
  { key: "club", title: "Club Call", prompt: "Which club does {g} hit off the tee?", type: "choice",
    options: ["Driver", "Wood", "Hybrid", "Long iron", "Mid iron", "Short iron", "Wedge", "Putter"] },
  { key: "shot", title: "Shot Prediction", prompt: "Where does {g}'s tee shot end up?", type: "choice",
    options: ["Fairway", "Rough", "Bunker", "Water", "Green"] },
  { key: "distance", title: "Distance Guess", prompt: "How far does {g}'s tee shot go? (yards)", type: "number" },
  { key: "disaster", title: "Disaster Prediction", prompt: "Does {g} hit something they absolutely shouldn't?", type: "choice",
    options: ["Yes", "No"] },
  { key: "trash", title: "Trash Talk", prompt: "Predict what happens to {g} on this hole.", type: "text" },
];

function caddyCardIdx(code, caddyId, golferId, hole) {
  let h = 0;
  for (const ch of code + caddyId + golferId + hole) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h % CADDY_CARDS.length;
}

function caddyPointsFor(kind, guess, outcome) {
  if (kind === "distance") {
    const d = Math.abs(parseInt(outcome, 10) - parseInt(guess, 10));
    return d <= 10 ? 3 : d <= 25 ? 1 : 0;
  }
  if (kind === "trash") return outcome === "yes" ? 3 : 0;
  return outcome === guess ? 3 : 0;
}

function caddyGuessText(kind, guess) {
  if (kind === "distance") return guess + " yards";
  if (kind === "disaster") return guess === "Yes" ? "a disaster" : "no disaster";
  if (kind === "trash") return "\u201C" + guess + "\u201D";
  return guess;
}

function caddyTotals(preds, mulls) {
  const m = {};
  preds.forEach(x => (m[x.caddy_id] = (m[x.caddy_id] || 0) + (x.points || 0)));
  mulls.forEach(x => (m[x.caddy_id] = (m[x.caddy_id] || 0) - 2));
  return m;
}
