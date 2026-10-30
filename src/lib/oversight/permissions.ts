import { formatEuro } from "@/lib/domain/money";
import {
  ACTION_TYPES,
  type ActionType,
  type PermissionMode,
  type PermissionRule,
  type PermissionsState,
} from "@/lib/domain/types";

export const ACTION_LABEL: Record<ActionType, string> = {
  offerte_versturen: "Offerte versturen",
  factuur_maken: "Factuur maken",
  afspraak_inplannen: "Afspraak inplannen",
  bon_boeken: "Bonnetje boeken",
  social_publiceren: "Social-media-post publiceren",
};

export const MODE_LABEL: Record<PermissionMode, string> = {
  altijd_vragen: "Altijd vragen",
  automatisch: "Automatisch binnen grenzen",
  uit: "Uit",
};

export const OWNER = { kind: "mens" as const, label: "Eigenaar" };
export const ASSISTANT = { kind: "ai" as const, label: "Geregeldwerk-assistent (mock)" };

export type GateEffect = "uitvoeren" | "wachtrij" | "weigeren";

export function defaultRule(actionType: ActionType): PermissionRule {
  const base = {
    actionType,
    businessStart: "08:00",
    businessEnd: "17:00",
    businessDays: [1, 2, 3, 4, 5],
  };
  if (actionType === "offerte_versturen") {
    return {
      ...base,
      mode: "automatisch",
      maxAmountCents: 50000,
      existingCustomersOnly: true,
      businessHoursOnly: true,
    };
  }
  if (actionType === "factuur_maken") {
    return {
      ...base,
      mode: "altijd_vragen",
      maxAmountCents: 100000,
      existingCustomersOnly: true,
      businessHoursOnly: false,
    };
  }
  if (actionType === "afspraak_inplannen") {
    return {
      ...base,
      mode: "automatisch",
      maxAmountCents: null,
      existingCustomersOnly: false,
      businessHoursOnly: true,
    };
  }
  if (actionType === "bon_boeken") {
    return {
      ...base,
      mode: "automatisch",
      maxAmountCents: 7500,
      existingCustomersOnly: false,
      businessHoursOnly: false,
    };
  }
  return {
    ...base,
    mode: "altijd_vragen",
    maxAmountCents: null,
    existingCustomersOnly: false,
    businessHoursOnly: false,
  };
}

export function defaultPermissions(): PermissionsState {
  return {
    emergencyStop: false,
    rules: ACTION_TYPES.map((actionType) => defaultRule(actionType)),
  };
}

export function isWithinBusinessHours(
  date: Date,
  rule: Pick<PermissionRule, "businessStart" | "businessEnd" | "businessDays">,
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday];
  if (!day || !rule.businessDays.includes(day)) return false;
  const hour = (parts.find((part) => part.type === "hour")?.value ?? "00").padStart(2, "0");
  const minute = (parts.find((part) => part.type === "minute")?.value ?? "00").padStart(2, "0");
  const current = `${hour}:${minute}`;
  return current >= rule.businessStart && current < rule.businessEnd;
}

export function evaluatePermission(input: {
  emergencyStop: boolean;
  rule: PermissionRule | undefined;
  amountCents: number | null;
  existingCustomer: boolean;
  at: Date;
}): { effect: GateEffect; reason: string } {
  const { rule } = input;
  if (!rule) {
    return { effect: "wachtrij", reason: "Geen permissieregel voor deze actie." };
  }
  if (rule.mode === "uit") {
    return { effect: "weigeren", reason: "Permissie staat uit." };
  }
  if (rule.mode === "altijd_vragen") {
    return { effect: "wachtrij", reason: "Deze actie staat op altijd vragen." };
  }
  if (input.emergencyStop) {
    return {
      effect: "wachtrij",
      reason: "Noodstop: automatische permissies zijn gepauzeerd.",
    };
  }
  if (rule.maxAmountCents != null) {
    if (input.amountCents == null) {
      return { effect: "wachtrij", reason: "Bedrag ontbreekt, de grens kan niet worden gecontroleerd." };
    }
    if (input.amountCents > rule.maxAmountCents) {
      return {
        effect: "wachtrij",
        reason: `Bedrag ${formatEuro(input.amountCents)} ligt boven het maximum van ${formatEuro(rule.maxAmountCents)}.`,
      };
    }
  }
  if (rule.existingCustomersOnly && !input.existingCustomer) {
    return { effect: "wachtrij", reason: "Alleen bestaande klanten vallen binnen deze permissie." };
  }
  if (rule.businessHoursOnly && !isWithinBusinessHours(input.at, rule)) {
    return { effect: "wachtrij", reason: "Buiten werktijd (Europe/Amsterdam)." };
  }
  return { effect: "uitvoeren", reason: "Binnen de permissie en de grenzen." };
}
