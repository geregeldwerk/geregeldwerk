import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

const getStripe = vi.fn();

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => getStripe(),
  STRIPE_NOT_CONFIGURED: "Betalen is nog niet geactiveerd. Zet de Stripe-testsleutel, dan opent de kassa.",
}));

import { POST } from "@/app/api/stripe/checkout/route";
import { sessionParams, startCheckout } from "@/lib/billing/checkout";

describe("checkout", () => {
  beforeEach(() => {
    getStripe.mockReset();
  });

  it("koppelt een pakket aan de lookup_key en hardcode geen price-id", async () => {
    const findPrice = vi.fn(async (lookupKey: string) => ({ id: `resolved-${lookupKey}` }));
    const createSession = vi.fn(async () => ({ url: "https://checkout.stripe.test/cs" }));
    const url = await startCheckout(
      { findPrice, createSession },
      { kind: "plan", planId: "professional", interval: "year" },
      { successUrl: "https://app.test/betaling/gelukt", cancelUrl: "https://app.test/betaling/geannuleerd" },
    );
    expect(url).toBe("https://checkout.stripe.test/cs");
    expect(findPrice).toHaveBeenCalledWith("professional_yearly");
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      line_items: [{ price: "resolved-professional_yearly", quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      metadata: expect.objectContaining({ lookupKey: "professional_yearly" }),
    }));
    const serialized = JSON.stringify(createSession.mock.calls);
    expect(serialized).not.toMatch(/price_[A-Za-z0-9]/);
  });

  it("zet eenmalige credits op payment", () => {
    const params = sessionParams({
      priceId: "resolved-addon_credits_50",
      mode: "payment",
      metadata: { kind: "addon", addonId: "credits-50", lookupKey: "addon_credits_50" },
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/cancel",
    });
    expect(params.mode).toBe("payment");
    expect(params.subscription_data).toBeUndefined();
  });

  it("geeft een nette melding zonder Stripe-sleutel", async () => {
    getStripe.mockReturnValue(null);
    const response = await POST(new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      body: JSON.stringify({ kind: "plan", planId: "starter", interval: "month" }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/nog niet geactiveerd/) });
  });

  it("vraagt de prijs via lookup_key in de route", async () => {
    const list = vi.fn(async () => ({ data: [{ id: "price_from_lookup" }] }));
    const create = vi.fn(async () => ({ url: "https://checkout.stripe.test/live-session" }));
    getStripe.mockReturnValue({ prices: { list }, checkout: { sessions: { create } } });
    const response = await POST(new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      body: JSON.stringify({ kind: "addon", addonId: "credits-150" }),
    }));
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ lookup_keys: ["addon_credits_150"], active: true, limit: 1 });
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.test/live-session" });
  });
});
