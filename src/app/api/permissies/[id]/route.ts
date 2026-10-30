import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { copyStore, decidePermissionProposal } from "@/lib/oversight/engine";
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
    let error: string | null = null;
    await getRepository().update((data) => {
      const result = decidePermissionProposal(data, id, body.decision as "goedgekeurd" | "afgewezen", comment);
      if (!result.ok) error = result.error;
      copyStore(data, result.store);
    });
    if (error) return jsonError(error);
    return Response.json({ ok: true });
  } catch (error) {
    return fromUnknownError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
