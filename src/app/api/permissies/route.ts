import { connection } from "next/server";
import { ACTION_TYPES, type PermissionMode, type PermissionRule } from "@/lib/domain/types";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { copyStore, proposePermissionChange } from "@/lib/oversight/engine";
import { isWithinBusinessHours } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  const now = new Date();
  return Response.json({
    permissions: data.permissions,
    proposals: data.permissionProposals,
    withinBusinessHours: isWithinBusinessHours(now, data.permissions.rules[0] ?? {
      businessStart: "08:00",
      businessEnd: "17:00",
      businessDays: [1, 2, 3, 4, 5],
    }),
  });
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = await readJson(request);
    if (!isRecord(body)) return jsonError("Ongeldige permissies.");
    const rules = parseRules(body.rules);
    if (!rules) return jsonError("Ongeldige permissies.");
    if (!ACTION_TYPES.every((type) => rules.some((rule) => rule.actionType === type))) {
      return jsonError("Elke actie heeft een regel nodig.");
    }
    let error: string | null = null;
    let proposalId: string | null = null;
    await getRepository().update((data) => {
      const result = proposePermissionChange(data, rules);
      if (!result.ok) error = result.error;
      else proposalId = result.proposalId;
      copyStore(data, result.store);
    });
    if (error) return jsonError(error);
    return Response.json({ proposalId }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}

function parseRules(value: unknown): PermissionRule[] | null {
  if (!Array.isArray(value)) return null;
  const modes: PermissionMode[] = ["altijd_vragen", "automatisch", "uit"];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.actionType !== "string" || typeof item.mode !== "string") return [];
    if (!modes.includes(item.mode as PermissionMode)) return [];
    if (!ACTION_TYPES.includes(item.actionType as (typeof ACTION_TYPES)[number])) return [];
    const max = item.maxAmountCents;
    const maxAmountCents = max == null || max === "" ? null : Number(max);
    return [
      {
        actionType: item.actionType as PermissionRule["actionType"],
        mode: item.mode as PermissionMode,
        maxAmountCents: Number.isFinite(maxAmountCents) ? maxAmountCents : null,
        existingCustomersOnly: Boolean(item.existingCustomersOnly),
        businessHoursOnly: Boolean(item.businessHoursOnly),
        businessStart: typeof item.businessStart === "string" ? item.businessStart : "08:00",
        businessEnd: typeof item.businessEnd === "string" ? item.businessEnd : "17:00",
        businessDays: Array.isArray(item.businessDays) ? item.businessDays.map((day) => Number(day)) : [1, 2, 3, 4, 5],
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
