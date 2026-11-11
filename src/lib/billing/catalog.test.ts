import { describe, expect, it } from "vitest";
import { assertEntitlement, checkLimit, EntitlementError, featuresForPlan } from "@/lib/billing/entitlements";
import { formatAddonPrice, formatPriceCents } from "@/lib/billing/format";
import { billingCatalog } from "@/lib/billing/seed";

describe("prijscatalogus", () => {
  it("zet de maand- en jaarbedragen vast, met twee maanden korting", () => {
    const paid = billingCatalog.plans.filter((plan) => plan.monthlyPriceCents != null);
    expect(paid.map((plan) => [plan.id, plan.monthlyPriceCents, plan.yearlyPriceCents])).toEqual([
      ["starter", 2995, 29950],
      ["professional", 5995, 59950],
      ["business", 11995, 119950],
    ]);
    for (const plan of paid) {
      expect(plan.yearlyPriceCents).toBe((plan.monthlyPriceCents ?? 0) * 10);
    }
    expect(billingCatalog.plans.find((plan) => plan.id === "enterprise")?.monthlyPriceCents).toBeNull();
    expect(billingCatalog.plans.find((plan) => plan.id === "professional")).toMatchObject({
      highlighted: true,
      badge: "Populair",
    });
    expect(billingCatalog.plans.find((plan) => plan.id === "starter")?.stripeLookupKey).toEqual({
      month: "starter_monthly",
      year: "starter_yearly",
    });
    expect(billingCatalog.plans.find((plan) => plan.id === "enterprise")?.stripeLookupKey).toBeNull();
    expect(billingCatalog.addons.map((addon) => addon.stripeLookupKey)).toEqual([
      "addon_extra_user",
      "addon_extra_profile",
      "addon_whatsapp_starter",
      "addon_credits_50",
      "addon_credits_150",
      "addon_credits_500",
      "addon_storage_10gb",
      "addon_onboarding",
      null,
    ]);
    expect(billingCatalog.vatNote).toBe("Alle prijzen exclusief btw");
    expect(billingCatalog.yearlyDiscountLabel).toBe("2 maanden gratis");
  });

  it("toont de bedragen in de afgesproken schrijfwijze", () => {
    expect(formatPriceCents(2995)).toBe("€29,95");
    expect(formatPriceCents(29950)).toBe("€299,50");
    expect(formatPriceCents(59950)).toBe("€599,50");
    expect(formatPriceCents(119950)).toBe("€1.199,50");
    expect(billingCatalog.addons.map((addon) => [addon.name, formatAddonPrice(addon)])).toEqual([
      ["extra gebruiker", "€5/mnd"],
      ["extra bedrijfsprofiel", "€14,95/mnd"],
      ["WhatsApp bij Starter", "€9,95/mnd"],
      ["50 extra AI-credits", "€9,95"],
      ["150 extra AI-credits", "€24,95"],
      ["500 extra AI-credits", "€59,95"],
      ["10 GB extra opslag", "€4,95/mnd"],
      ["persoonlijke onboarding", "€99 eenmalig"],
      ["maatwerk automatisering", "vanaf €149"],
    ]);
  });

  it("houdt de limieten en functies per pakket aan", () => {
    const byId = Object.fromEntries(billingCatalog.plans.map((plan) => [plan.id, plan]));
    expect(byId.starter.limits.map((item) => item.display)).toEqual([
      "40 AI-offertes",
      "1 gebruiker",
      "1 bedrijfsprofiel",
      "10 diensten/producten",
      "2 templates",
      "1 e-mailadres",
      "1 GB opslag",
    ]);
    expect(byId.starter.features.map((item) => item.label)).toEqual([
      "aanvraagformulier",
      "AI-verwerking",
      "conceptoffertes",
      "PDF-export",
      "eigen huisstijl, tarieven en btw",
      "klantenbeheer",
      "offertehistorie",
      "basisdashboard",
    ]);
    expect(byId.professional.features.map((item) => item.label)).toContain("WhatsApp-integratie");
    expect(byId.business.limits.find((item) => item.key === "services")).toMatchObject({ unlimited: true });
    expect(byId.enterprise.cta).toEqual({ label: "Neem contact op", href: "#contact" });
  });
});

describe("entitlements", () => {
  it("geeft Professional de functies van Starter en stopt boven de limiet", () => {
    expect(featuresForPlan("professional").has("aanvraagformulier")).toBe(true);
    expect(featuresForPlan("starter").has("whatsapp")).toBe(false);
    assertEntitlement("professional", "whatsapp");
    expect(() => assertEntitlement("starter", "whatsapp")).toThrow(EntitlementError);

    expect(checkLimit("starter", "aiQuotes", 40).ok).toBe(true);
    expect(checkLimit("starter", "aiQuotes", 41)).toMatchObject({ ok: false, remaining: -1 });
    expect(checkLimit("business", "services", 1000)).toMatchObject({ ok: true, unlimited: true });
    expect(checkLimit("enterprise", "users", 1)).toMatchObject({ ok: false, custom: true });
    expect(checkLimit("starter", "storageGb", 11, 10)).toMatchObject({ ok: true, limit: 11 });
  });
});
