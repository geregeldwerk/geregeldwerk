/**
 * Catalogus voor pakketten, limieten, functies en uitbreidingen.
 *
 * Dit is de voorbereiding op een database. Er is nog geen tabel, geen
 * abonnement en geen handhaving in de routes. Die vervolg-PR komt na CRM PR #5
 * en leest het abonnement server-side, nooit uit de client.
 *
 * Voorgestelde tabellen:
 * - plans (id, name, monthly_price_cents, yearly_price_cents, highlighted, badge, includes_plan_id)
 * - plan_limits (plan_id, key, value, unlimited, custom, unit, label, display)
 * - plan_features (plan_id, key, label, position)
 * - addons (id, name, price_cents, prefix, suffix, whole_euros)
 * - subscriptions (id, company_id, plan_id, interval, status, period_start, period_end)
 * - subscription_addons (subscription_id, addon_id, quantity)
 * - usage (company_id, key, period, used)
 */

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const PLAN_IDS = ["starter", "professional", "business", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const LIMIT_KEYS = [
  "aiQuotes",
  "users",
  "companyProfiles",
  "services",
  "templates",
  "emailAddresses",
  "storageGb",
] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export interface PlanLimit {
  key: LimitKey;
  /** Korte rijnaam in de vergelijkingstabel. */
  label: string;
  /** Tekst bovenaan de pakketkaart. */
  display: string;
  /** null bij onbeperkt of een maatwerkafspraak. */
  value: number | null;
  unlimited: boolean;
  /** Geen vast getal; een contract bepaalt de grens. */
  custom: boolean;
}

export interface PlanFeature {
  key: string;
  label: string;
}

export interface Plan {
  id: PlanId;
  name: string;
  highlighted: boolean;
  badge: string | null;
  /** null = prijs op aanvraag. */
  monthlyPriceCents: number | null;
  yearlyPriceCents: number | null;
  /** Recht op de functies van dit pakket, bovenop de eigen lijst. */
  includesPlanId: PlanId | null;
  limits: PlanLimit[];
  features: PlanFeature[];
  /** null bij Enterprise: geen Stripe-prijs. */
  stripeLookupKey: { month: string; year: string } | null;
  cta: { label: string; href: string };
}

export interface Addon {
  id: string;
  name: string;
  priceCents: number;
  /** Bijvoorbeeld "vanaf ". */
  prefix: string;
  /** Bijvoorbeeld "/mnd" of " eenmalig". */
  suffix: string;
  /** Hele euro's zonder ,00. */
  wholeEuros: boolean;
  /** null als deze uitbreiding niet in Stripe staat, zoals maatwerk. */
  stripeLookupKey: string | null;
  /** recurring = subscription, one_time = payment. */
  stripeMode: "subscription" | "payment" | null;
}

export interface CompanySubscription {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planId: "starter" | "professional" | "business";
  interval: BillingInterval;
  status: string;
  lookupKey: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
}

export interface BillingPurchase {
  checkoutSessionId: string;
  addonId: string;
  lookupKey: string;
  stripeCustomerId: string | null;
  paidAt: string;
}

export interface BillingCatalog {
  brand: "GeregeldWerk";
  yearlyDiscountLabel: "2 maanden voordeel bij jaarlijks betalen";
  yearlyDiscountBadge: "2 maanden voordeel";
  vatNote: "Alle prijzen exclusief btw";
  priceFootnote: "Alle prijzen exclusief btw. Kosten voor WhatsApp-berichten en eventuele externe berichtkosten worden apart berekend.";
  /**
   * Nog geen vast contactadres. De link opent alleen het mailprogramma
   * en verstuurt niets vanaf de server.
   */
  enterpriseMailto: string;
  plans: Plan[];
  addons: Addon[];
}
