import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { buildOversightExport, copyStore, setEmergencyStop } from "@/lib/oversight/engine";
import { isWithinBusinessHours } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  const now = new Date();
  const sample = data.permissions.rules[0];
  return Response.json({
    ...buildOversightExport(data, now),
    withinBusinessHours: sample ? isWithinBusinessHours(now, sample) : false,
  });
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = await readJson(request);
    if (!isRecord(body) || typeof body.paused !== "boolean") {
      return jsonError("Zeg of de noodstop aan of uit moet.");
    }
    await getRepository().update((data) => {
      copyStore(data, setEmergencyStop(data, body.paused as boolean));
    });
    const data = await getRepository().read();
    return Response.json(buildOversightExport(data));
  } catch (error) {
    return fromUnknownError(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
