/** Publieke ingang voor de landingspagina. De gegevens staan in de billing-seed. */
export { billingCatalog, getPlan } from "@/lib/billing/seed";
export { formatAddonPrice, formatPriceCents } from "@/lib/billing/format";
export type { Addon, BillingCatalog, BillingInterval, Plan, PlanId } from "@/lib/billing/types";
