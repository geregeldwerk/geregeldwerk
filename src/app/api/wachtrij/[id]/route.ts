import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { copyStore, decideApproval } from "@/lib/oversight/engine";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    if (!isRecord(body) || (body.decision !== "goedgekeurd" && body.decision !== "afgewezen")) {
      return jsonError("Kies goedkeuren of afwijzen.");
    }
    const comment = typeof body.comment === "string" ? body.comment.trim() : null;
    let effect = "fout";
    let reason = "Onbekend";
    await getRepository().update((data) => {
      const result = decideApproval(data, id, body.decision as "goedgekeurd" | "afgewezen", comment);
      effect = result.effect;
      reason = result.reason;
      copyStore(data, result.store);
    });
    const status = effect === "fout" ? 400 : 200;
    return Response.json({ effect, reason }, { status });
  } catch (error) {
    return fromUnknownError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
