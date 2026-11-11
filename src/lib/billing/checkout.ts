import type Stripe from "stripe";
import { billingCatalog, getPlan, lookupKeyForPlan } from "@/lib/billing/seed";
import type { BillingInterval, PlanId } from "@/lib/billing/types";

export class CheckoutInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutInputError";
  }
}

export type CheckoutRequest =
  | { kind: "plan"; planId: PlanId; interval: BillingInterval }
  | { kind: "addon"; addonId: string };

export interface CheckoutPrice {
  id: string;
}

export interface CheckoutGateway {
  findPrice(lookupKey: string): Promise<CheckoutPrice | null>;
  createSession(params: Stripe.Checkout.SessionCreateParams): Promise<{ url: string | null }>;
}

export function lookupKeyForRequest(input: CheckoutRequest): { lookupKey: string; mode: "subscription" | "payment"; metadata: Record<string, string> } {
  if (input.kind === "plan") {
    if (input.planId === "enterprise") {
      throw new CheckoutInputError("Enterprise heeft geen online kassa. Neem contact op.");
    }
    const plan = getPlan(input.planId);
    const lookupKey = lookupKeyForPlan(plan, input.interval);
    if (!lookupKey) throw new CheckoutInputError("Dit pakket heeft geen Stripe-prijs.");
    return {
      lookupKey,
      mode: "subscription",
      metadata: { kind: "plan", planId: input.planId, interval: input.interval, lookupKey },
    };
  }
  const addon = billingCatalog.addons.find((item) => item.id === input.addonId);
  if (!addon || !addon.stripeLookupKey || !addon.stripeMode) {
    throw new CheckoutInputError("Deze uitbreiding reken je niet online af.");
  }
  return {
    lookupKey: addon.stripeLookupKey,
    mode: addon.stripeMode,
    metadata: { kind: "addon", addonId: addon.id, lookupKey: addon.stripeLookupKey },
  };
}

/**
 * TODO(btw): automatic_tax aanzetten zodra Stripe Tax in de testaccount aan staat.
 * Zonder die instelling weigert Stripe de sessie. Prijzen zijn al exclusive.
 */
export function sessionParams(input: {
  priceId: string;
  mode: "subscription" | "payment";
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: input.mode,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    metadata: input.metadata,
    client_reference_id: input.metadata.planId ?? input.metadata.addonId,
  };
  if (input.mode === "subscription") {
    params.subscription_data = { metadata: input.metadata };
  }
  return params;
}

export async function startCheckout(
  gateway: CheckoutGateway,
  input: CheckoutRequest,
  urls: { successUrl: string; cancelUrl: string },
): Promise<string> {
  const resolved = lookupKeyForRequest(input);
  const price = await gateway.findPrice(resolved.lookupKey);
  if (!price) {
    throw new CheckoutInputError(`Geen actieve Stripe-prijs met lookup_key ${resolved.lookupKey}.`);
  }
  const session = await gateway.createSession(
    sessionParams({
      priceId: price.id,
      mode: resolved.mode,
      metadata: resolved.metadata,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    }),
  );
  if (!session.url) throw new CheckoutInputError("Stripe gaf geen betaalpagina terug.");
  return session.url;
}
