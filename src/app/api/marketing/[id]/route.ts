import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { copyStore, schedulePost } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.scheduledFor !== "string" || !body.scheduledFor.trim()) {
      return jsonError("Kies een moment om in te plannen.");
    }
    await getRepository().update((data) => {
      copyStore(data, schedulePost(data, id, body.scheduledFor as string, OWNER, new Date()));
    });
    return Response.json({ ok: true });
  } catch (error) {
    return fromUnknownError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
