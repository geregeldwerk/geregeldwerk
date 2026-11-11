import Stripe from "stripe";

let cached: { key: string; client: Stripe } | null = null;

export function stripeSecret(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key ? key : null;
}

export function webhookSecret(): string | null {
  const key = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return key ? key : null;
}

/** Geen client zonder testsleutel. De app blijft dan gewoon werken. */
export function getStripe(): Stripe | null {
  const key = stripeSecret();
  if (!key) return null;
  if (!cached || cached.key !== key) {
    cached = { key, client: new Stripe(key) };
  }
  return cached.client;
}

export const STRIPE_NOT_CONFIGURED =
  "Betalen is nog niet geactiveerd. Zet de Stripe-testsleutel, dan opent de kassa.";
