import { connection } from "next/server";
import { CheckoutInputError, startCheckout, type CheckoutGateway, type CheckoutRequest } from "@/lib/billing/checkout";
import { getStripe, STRIPE_NOT_CONFIGURED } from "@/lib/billing/stripe";
import type Stripe from "stripe";

function parseCheckout(value: unknown): CheckoutRequest {
  if (!value || typeof value !== "object") throw new CheckoutInputError("Ongeldig verzoek.");
  const body = value as Record<string, unknown>;
  if (body.kind === "plan") {
    if (body.planId !== "starter" && body.planId !== "professional" && body.planId !== "business") {
      throw new CheckoutInputError("Onbekend pakket.");
    }
    if (body.interval !== "month" && body.interval !== "year") throw new CheckoutInputError("Kies maand of jaar.");
    return { kind: "plan", planId: body.planId, interval: body.interval };
  }
  if (body.kind === "addon" && typeof body.addonId === "string" && body.addonId.trim()) {
    return { kind: "addon", addonId: body.addonId };
  }
  throw new CheckoutInputError("Ongeldig verzoek.");
}

export function gatewayFor(stripe: Stripe): CheckoutGateway {
  return {
    async findPrice(lookupKey) {
      const list = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
      const price = list.data[0];
      return price ? { id: price.id } : null;
    },
    async createSession(params) {
      const session = await stripe.checkout.sessions.create(params);
      return { url: session.url };
    },
  };
}

export async function POST(request: Request) {
  await connection();
  const stripe = getStripe();
  if (!stripe) return Response.json({ error: STRIPE_NOT_CONFIGURED }, { status: 503 });
  try {
    const input = parseCheckout(await request.json().catch(() => null));
    const origin = new URL(request.url).origin;
    const url = await startCheckout(gatewayFor(stripe), input, {
      successUrl: `${origin}/betaling/gelukt?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/betaling/geannuleerd`,
    });
    return Response.json({ url });
  } catch (error) {
    if (error instanceof CheckoutInputError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Stripe-checkout mislukt");
    return Response.json({ error: "De kassa van Stripe is nu niet bereikbaar." }, { status: 502 });
  }
}
