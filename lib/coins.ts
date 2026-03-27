export const COIN_TO_NAIRA = 1; // 1 DC = ₦1

export const FACE_REVEAL_COST = 1000;
export const FACE_REVEAL_MODEL_SHARE = 500;
export const FACE_REVEAL_ADMIN_SHARE = 500;
export const FACE_REVEAL_EXPIRY_HOURS = 24;

export const CONNECTION_FEE_PERCENT = 0.15; // 15% from client + 15% from model

export const MEET_LIMITS = {
  SHORT:     { label: "Short Meet",  min: 30000,  max: 50000  },
  OVERNIGHT: { label: "Overnight",   min: 60000,  max: 100000 },
  WEEKEND:   { label: "Weekend",     min: 150000, max: 300000 },
} as const;

export function coinsToNaira(coins: number): number {
  return coins * COIN_TO_NAIRA;
}

export function nairaToCoins(naira: number): number {
  return Math.floor(naira / COIN_TO_NAIRA);
}

export function formatCoins(coins: number): string {
  return `${coins.toLocaleString()} DC`;
}

export function formatNaira(naira: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(naira);
}

export function coinsToNairaFormatted(coins: number): string {
  return formatNaira(coinsToNaira(coins));
}

export function calculateConnectionFees(offerCoins: number): {
  clientFee: number;
  modelFee: number;
  adminTotal: number;
  modelReceives: number;
  clientTotal: number;
} {
  const clientFee = Math.floor(offerCoins * CONNECTION_FEE_PERCENT);
  const modelFee  = Math.floor(offerCoins * CONNECTION_FEE_PERCENT);
  const adminTotal     = clientFee + modelFee;
  const modelReceives  = offerCoins - modelFee;
  const clientTotal    = offerCoins + clientFee;
  return { clientFee, modelFee, adminTotal, modelReceives, clientTotal };
}

export function validateOffer(
  offerCoins: number,
  meetType: keyof typeof MEET_LIMITS,
  modelMin: number,
  modelMax: number
): { valid: boolean; reason?: string } {
  if (offerCoins < modelMin)
    return { valid: false, reason: `Minimum offer is ${formatCoins(modelMin)}` };
  if (offerCoins > modelMax)
    return { valid: false, reason: `Maximum offer is ${formatCoins(modelMax)}` };
  const g = MEET_LIMITS[meetType];
  if (offerCoins < g.min)
    return { valid: false, reason: `Global minimum for ${g.label} is ${formatCoins(g.min)}` };
  return { valid: true };
}

export function generateCouponCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return [4, 4, 4]
    .map((len) =>
      Array.from({ length: len })
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join("")
    )
    .join("-");
}

export function generateRedemptionToken(): string {
  return Array.from({ length: 32 })
    .map(() => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)])
    .join("");
}

export function faceRevealExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + FACE_REVEAL_EXPIRY_HOURS);
  return d;
}