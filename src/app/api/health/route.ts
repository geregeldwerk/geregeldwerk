import { connection } from "next/server";
import { resolveProvider } from "@/lib/llm";

export async function GET() {
  await connection();
  const resolved = resolveProvider();
  return Response.json({
    ok: true,
    provider: resolved.provider.id,
    warning: resolved.warning,
  });
}
