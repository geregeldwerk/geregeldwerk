import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import type { ActionPayload } from "@/lib/domain/types";
import { copyStore, requestAction } from "@/lib/oversight/engine";
import { ASSISTANT, OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function POST(request: Request) {
  await connection();
  try {
    const body = await readJson(request);
    if (!isRecord(body) || !isPayload(body.payload)) {
      return jsonError("Ongeldige actie.");
    }
    const actor = body.actor === "ai" ? ASSISTANT : OWNER;
    const summary = typeof body.summary === "string" ? body.summary : undefined;
    let effect = "fout";
    let reason = "Onbekend";
    let approvalId: string | null = null;
    await getRepository().update((data) => {
      const result = requestAction(data, { actor, summary, payload: body.payload as ActionPayload }, new Date());
      effect = result.effect;
      reason = result.reason;
      approvalId = result.approvalId;
      copyStore(data, result.store);
    });
    return Response.json({ effect, reason, approvalId });
  } catch (error) {
    return fromUnknownError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPayload(value: unknown): value is ActionPayload {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  return (
    value.type === "offerte_versturen" ||
    value.type === "factuur_maken" ||
    value.type === "afspraak_inplannen" ||
    value.type === "bon_boeken" ||
    value.type === "social_publiceren"
  );
}
