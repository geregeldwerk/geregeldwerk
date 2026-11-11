import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedData } from "@/lib/storage/seed";
import { applyStripeEvent } from "@/lib/billing/events";
import type { StoreData } from "@/lib/domain/types";

vi.mock("next/server", () => ({ connection: async () => undefined }));

const constructEvent = vi.fn();
const update = vi.fn();

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
  webhookSecret: () => "whsec_test",
}));

vi.mock("@/lib/storage", () => ({
  getRepository: () => ({ update }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

function store(): StoreData {
  return createSeedData();
}

describe("stripe webhook", () => {
  beforeEach(() => {
    constructEvent.mockReset();
    update.mockReset();
    update.mockImplementation(async (mutator: (data: StoreData) => void) => {
      const data = store();
      mutator(data);
      return data;
    });
  });

  it("weigert een ongeldige handtekening", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const response = await POST(new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=fake" },
      body: "{}",
    }));
    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("bewaart een abonnement en slaat hetzelfde event de tweede keer over", async () => {
    const data = store();
    const event = {
      id: "evt_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          cancel_at_period_end: false,
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
          metadata: { planId: "starter", interval: "month", lookupKey: "starter_monthly" },
        },
      },
    };
    expect(applyStripeEvent(data, event)).toEqual({ duplicate: false, handled: true });
    expect(data.subscription).toMatchObject({
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      planId: "starter",
      interval: "month",
      status: "active",
      lookupKey: "starter_monthly",
    });
    expect(applyStripeEvent(data, event)).toEqual({ duplicate: true, handled: false });
    expect(data.processedStripeEvents?.filter((id) => id === "evt_1")).toEqual(["evt_1"]);
  });

  it("zet opgezegd bij subscription.deleted en bewaart een eenmalige aankoop één keer", () => {
    const data = store();
    applyStripeEvent(data, {
      id: "evt_buy",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "payment",
          customer: "cus_1",
          metadata: { kind: "addon", addonId: "credits-50", lookupKey: "addon_credits_50" },
        },
      },
    });
    applyStripeEvent(data, {
      id: "evt_buy",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "payment",
          customer: "cus_1",
          metadata: { kind: "addon", addonId: "credits-50", lookupKey: "addon_credits_50" },
        },
      },
    });
    expect(data.billingPurchases).toHaveLength(1);

    applyStripeEvent(data, {
      id: "evt_del",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_9",
          customer: "cus_9",
          status: "canceled",
          metadata: { planId: "business", interval: "year", lookupKey: "business_yearly" },
        },
      },
    });
    expect(data.subscription).toMatchObject({ status: "canceled", planId: "business", interval: "year" });
  });

  it("verwerkt een geldig event via de route", async () => {
    constructEvent.mockReturnValue({
      id: "evt_route",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_route",
          customer: "cus_route",
          status: "trialing",
          metadata: { planId: "professional", interval: "year", lookupKey: "professional_yearly" },
        },
      },
    });
    const response = await POST(new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=ok" },
      body: "{}",
    }));
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
  });
});
