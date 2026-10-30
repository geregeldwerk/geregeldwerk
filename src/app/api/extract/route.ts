import { connection } from "next/server";
import { jsonError } from "@/lib/api/http";
import { resolveProvider } from "@/lib/llm";

export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Stuur een tekstbericht mee.");
  }
  if (typeof body !== "object" || body === null || !("text" in body) || typeof body.text !== "string") {
    return jsonError("Stuur een tekstbericht mee.");
  }
  const text = body.text.trim();
  if (!text) return jsonError("Het bericht is leeg.");
  if (text.length > 8000) return jsonError("Het bericht is te lang (maximaal 8000 tekens).");

  const resolved = resolveProvider();
  try {
    const extraction = await resolved.provider.extract(text);
    return Response.json({
      extraction,
      provider: resolved.provider.id,
      warning: resolved.warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "De assistent kon het bericht niet lezen.";
    return jsonError(message, 502);
  }
}
