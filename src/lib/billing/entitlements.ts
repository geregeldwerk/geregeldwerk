import { getPlan } from "@/lib/billing/seed";
import type { LimitKey, Plan, PlanId } from "@/lib/billing/types";

/**
 * Voorbereiding op server-side rechten. Nog niet aangesloten op routes.
 *
 * In de vervolg-PR bepaalt de server het abonnement van het bedrijf.
 * planId uit de browser is dan geen bron. Deze functies lezen nu alleen
 * de catalogus, zodat de rekenregels al vastliggen.
 */
export class EntitlementError extends Error {
  readonly code: "missing_feature" | "limit_exceeded" | "custom_plan" | "invalid_usage";

  constructor(code: EntitlementError["code"], message: string) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
  }
}

export interface LimitCheck {
  key: LimitKey;
  used: number;
  limit: number | null;
  unlimited: boolean;
  custom: boolean;
  ok: boolean;
  remaining: number | null;
}

function inheritedPlans(planId: PlanId): Plan[] {
  const chain: Plan[] = [];
  const seen = new Set<PlanId>();
  let current: PlanId | null = planId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const plan: Plan = getPlan(current);
    chain.push(plan);
    current = plan.includesPlanId;
  }
  return chain;
}

export function featuresForPlan(planId: PlanId): Set<string> {
  const keys = new Set<string>();
  for (const plan of inheritedPlans(planId)) {
    for (const feature of plan.features) keys.add(feature.key);
  }
  return keys;
}

export function assertEntitlement(planId: PlanId, featureKey: string): void {
  if (!featuresForPlan(planId).has(featureKey)) {
    throw new EntitlementError("missing_feature", `Pakket ${planId} heeft geen functie ${featureKey}.`);
  }
}

/**
 * extra telt mee als extra ruimte uit een uitbreiding, in dezelfde eenheid als de limiet.
 * Een maatwerkpakket zonder vast getal is niet automatisch toegestaan.
 */
export function checkLimit(planId: PlanId, key: LimitKey, used: number, extra = 0): LimitCheck {
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(extra) || extra < 0) {
    throw new EntitlementError("invalid_usage", "Gebruik en extra ruimte moeten nul of hoger zijn.");
  }
  const row = getPlan(planId).limits.find((item) => item.key === key);
  if (!row) throw new EntitlementError("custom_plan", `Pakket ${planId} heeft geen limiet ${key}.`);
  if (row.unlimited) {
    return { key, used, limit: null, unlimited: true, custom: false, ok: true, remaining: null };
  }
  if (row.custom || row.value == null) {
    return { key, used, limit: null, unlimited: false, custom: true, ok: false, remaining: null };
  }
  const limit = row.value + extra;
  const remaining = limit - used;
  return {
    key,
    used,
    limit,
    unlimited: false,
    custom: false,
    ok: used <= limit,
    remaining,
  };
}
