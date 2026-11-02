// Coin bundles for sale. The only place that says which bundle gives how many coins (the app's list is display only).
export const COIN_BUNDLES = {
  "10": { coins: 10, priceEnv: "STRIPE_PRICE_COINS_10" },
  "60": { coins: 60, priceEnv: "STRIPE_PRICE_COINS_60" },
  "150": { coins: 150, priceEnv: "STRIPE_PRICE_COINS_150" }
};

export const isBundleCoins = n => Object.values(COIN_BUNDLES).some(b => b.coins === n);
