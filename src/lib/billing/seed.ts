import type { Addon, BillingCatalog, Plan, PlanFeature, PlanLimit } from "@/lib/billing/types";

function limit(
  key: PlanLimit["key"],
  label: string,
  display: string,
  value: number | null,
  flags: { unlimited?: boolean; custom?: boolean } = {},
): PlanLimit {
  return {
    key,
    label,
    display,
    value,
    unlimited: flags.unlimited ?? false,
    custom: flags.custom ?? false,
  };
}

function features(items: Array<[string, string]>): PlanFeature[] {
  return items.map(([key, label]) => ({ key, label }));
}

const starterLimits: PlanLimit[] = [
  limit("aiQuotes", "AI-offertes", "40 AI-offertes", 40),
  limit("users", "Gebruikers", "1 gebruiker", 1),
  limit("companyProfiles", "Bedrijfsprofielen", "1 bedrijfsprofiel", 1),
  limit("services", "Diensten/producten", "10 diensten/producten", 10),
  limit("templates", "Templates", "2 templates", 2),
  limit("emailAddresses", "E-mailadressen", "1 e-mailadres", 1),
  limit("storageGb", "Opslag", "1 GB opslag", 1),
];

const professionalLimits: PlanLimit[] = [
  limit("aiQuotes", "AI-offertes", "150 AI-offertes", 150),
  limit("users", "Gebruikers", "3 gebruikers", 3),
  limit("companyProfiles", "Bedrijfsprofielen", "2 bedrijfsprofielen", 2),
  limit("services", "Diensten/producten", "50 diensten/producten", 50),
  limit("templates", "Templates", "5 templates", 5),
  limit("emailAddresses", "E-mailadressen", "3 e-mailadressen", 3),
  limit("storageGb", "Opslag", "10 GB opslag", 10),
];

const businessLimits: PlanLimit[] = [
  limit("aiQuotes", "AI-offertes", "500 AI-offertes", 500),
  limit("users", "Gebruikers", "10 gebruikers", 10),
  limit("companyProfiles", "Bedrijfsprofielen", "5 bedrijfsprofielen", 5),
  limit("services", "Diensten/producten", "onbeperkt diensten/producten", null, { unlimited: true }),
  limit("templates", "Templates", "15 templates", 15),
  limit("emailAddresses", "E-mailadressen", "10 e-mailadressen", 10),
  limit("storageGb", "Opslag", "50 GB opslag", 50),
];

const enterpriseLimits: PlanLimit[] = [
  limit("aiQuotes", "AI-offertes", "aangepaste AI-capaciteit", null, { custom: true }),
  limit("users", "Gebruikers", "gebruikers", null, { custom: true }),
  limit("companyProfiles", "Bedrijfsprofielen", "bedrijfsprofielen en vestigingen", null, { custom: true }),
  limit("services", "Diensten/producten", "aangepast", null, { custom: true }),
  limit("templates", "Templates", "aangepast", null, { custom: true }),
  limit("emailAddresses", "E-mailadressen", "aangepast", null, { custom: true }),
  limit("storageGb", "Opslag", "aangepast", null, { custom: true }),
];

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    highlighted: false,
    badge: null,
    monthlyPriceCents: 2995,
    yearlyPriceCents: 29950,
    includesPlanId: null,
    limits: starterLimits,
    features: features([
      ["aanvraagformulier", "aanvraagformulier"],
      ["ai-verwerking", "AI-verwerking"],
      ["conceptoffertes", "conceptoffertes"],
      ["pdf-export", "PDF-export"],
      ["huisstijl", "eigen huisstijl, tarieven en btw"],
      ["klantenbeheer", "klantenbeheer"],
      ["offertehistorie", "offertehistorie"],
      ["basisdashboard", "basisdashboard"],
    ]),
    cta: { label: "Kies Starter", href: "/api/stripe/checkout" },
    stripeLookupKey: { month: "starter_monthly", year: "starter_yearly" },
  },
  {
    id: "professional",
    name: "Professional",
    highlighted: true,
    badge: "Populair",
    monthlyPriceCents: 5995,
    yearlyPriceCents: 59950,
    includesPlanId: "starter",
    limits: professionalLimits,
    features: features([
      ["alles-starter", "alles uit Starter"],
      ["whatsapp", "WhatsApp-integratie"],
      ["ai-whatsapp-email", "AI-verwerking via WhatsApp en e-mail"],
      ["klantgegevensherkenning", "automatische klantgegevensherkenning"],
      ["offertevoorwaarden", "offertevoorwaarden"],
      ["versturen-na-goedkeuring", "versturen na goedkeuring"],
      ["opvolging", "automatische opvolging"],
      ["offertestatussen", "offertestatussen"],
      ["conversieoverzicht", "conversieoverzicht"],
      ["klantenbeheer-uitgebreid", "uitgebreid klantenbeheer en statistieken"],
    ]),
    cta: { label: "Kies Professional", href: "/api/stripe/checkout" },
    stripeLookupKey: { month: "professional_monthly", year: "professional_yearly" },
  },
  {
    id: "business",
    name: "Business",
    highlighted: false,
    badge: null,
    monthlyPriceCents: 11995,
    yearlyPriceCents: 119950,
    includesPlanId: "professional",
    limits: businessLimits,
    features: features([
      ["alles-professional", "alles uit Professional"],
      ["whatsapp-kanalen", "meerdere WhatsApp-kanalen"],
      ["ai-geavanceerd", "geavanceerde AI"],
      ["workflows", "eigen workflows"],
      ["opvolging-business", "automatische opvolging"],
      ["prijslijsten", "meerdere prijslijsten"],
      ["rollen", "medewerkersrollen"],
      ["goedkeuring", "goedkeuringsprocessen"],
      ["rapportages", "geavanceerde rapportages"],
      ["omzet-conversie", "omzet- en conversieanalyses"],
      ["api", "API"],
      ["webhooks", "webhooks"],
      ["portaal-domein", "eigen aanvraagportaal-domein"],
      ["prioriteit-support", "prioriteit support"],
    ]),
    cta: { label: "Kies Business", href: "/api/stripe/checkout" },
    stripeLookupKey: { month: "business_monthly", year: "business_yearly" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    highlighted: false,
    badge: null,
    monthlyPriceCents: null,
    yearlyPriceCents: null,
    includesPlanId: null,
    limits: enterpriseLimits,
    features: features([
      ["ai-workflows", "eigen AI-workflows"],
      ["integraties", "geavanceerde integraties"],
      ["api-maatwerk", "maatwerk API"],
      ["beveiliging", "uitgebreide beveiliging"],
      ["onboarding-dedicated", "dedicated onboarding"],
      ["sla", "SLA"],
      ["ondersteuning", "persoonlijke ondersteuning"],
      ["infrastructuur", "maatwerk infrastructuur"],
    ]),
    cta: { label: "Neem contact op", href: "#contact" },
    stripeLookupKey: null,
  },
];

const addons: Addon[] = [
  { id: "extra-user", name: "extra gebruiker", priceCents: 500, prefix: "", suffix: "/mnd", wholeEuros: true, stripeLookupKey: "addon_extra_user", stripeMode: "subscription" },
  { id: "extra-company", name: "extra bedrijfsprofiel", priceCents: 1495, prefix: "", suffix: "/mnd", wholeEuros: false, stripeLookupKey: "addon_extra_profile", stripeMode: "subscription" },
  { id: "whatsapp-starter", name: "WhatsApp bij Starter", priceCents: 995, prefix: "", suffix: "/mnd", wholeEuros: false, stripeLookupKey: "addon_whatsapp_starter", stripeMode: "subscription" },
  { id: "credits-50", name: "50 extra AI-credits", priceCents: 995, prefix: "", suffix: "", wholeEuros: false, stripeLookupKey: "addon_credits_50", stripeMode: "payment" },
  { id: "credits-150", name: "150 extra AI-credits", priceCents: 2495, prefix: "", suffix: "", wholeEuros: false, stripeLookupKey: "addon_credits_150", stripeMode: "payment" },
  { id: "credits-500", name: "500 extra AI-credits", priceCents: 5995, prefix: "", suffix: "", wholeEuros: false, stripeLookupKey: "addon_credits_500", stripeMode: "payment" },
  { id: "storage-10", name: "10 GB extra opslag", priceCents: 495, prefix: "", suffix: "/mnd", wholeEuros: false, stripeLookupKey: "addon_storage_10gb", stripeMode: "subscription" },
  { id: "onboarding", name: "persoonlijke onboarding", priceCents: 9900, prefix: "", suffix: " eenmalig", wholeEuros: true, stripeLookupKey: "addon_onboarding", stripeMode: "payment" },
  { id: "custom-automation", name: "maatwerk automatisering", priceCents: 14900, prefix: "vanaf ", suffix: "", wholeEuros: true, stripeLookupKey: null, stripeMode: null },
];

export const billingCatalog: BillingCatalog = {
  brand: "GeregeldWerk",
  yearlyDiscountLabel: "2 maanden gratis",
  vatNote: "Alle prijzen exclusief btw",
  priceFootnote:
    "Alle prijzen exclusief btw. Kosten voor WhatsApp-berichten en eventuele externe berichtkosten worden apart berekend.",
  enterpriseMailto:
    "mailto:?subject=GeregeldWerk%20Enterprise&body=Ik%20wil%20graag%20meer%20weten%20over%20Enterprise.",
  plans,
  addons,
};

export function lookupKeyForPlan(plan: Plan, interval: "month" | "year"): string | null {
  return plan.stripeLookupKey?.[interval] ?? null;
}

export function getPlan(planId: Plan["id"]): Plan {
  const plan = billingCatalog.plans.find((item) => item.id === planId);
  if (!plan) throw new Error(`Onbekend pakket: ${planId}`);
  return plan;
}
