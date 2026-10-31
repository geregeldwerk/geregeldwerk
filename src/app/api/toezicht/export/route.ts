import { connection } from "next/server";
import { buildOversightExport } from "@/lib/oversight/engine";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  const body = buildOversightExport(data);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"geregeldwerk-toezicht.json\"",
    },
  });
}
