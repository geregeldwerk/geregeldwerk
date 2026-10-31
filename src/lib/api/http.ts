import { QuoteInputError } from "@/lib/domain/quote";
import { PermissionError } from "@/lib/oversight/engine";

export function jsonError(message: string, status = 400, issues?: string[]) {
  return Response.json({ error: message, issues }, { status });
}

export function fromUnknownError(error: unknown) {
  if (error instanceof QuoteInputError) {
    return jsonError(error.message, 400, error.issues);
  }
  if (error instanceof PermissionError) {
    return jsonError(error.message, 409);
  }
  console.error(error);
  return jsonError("Er ging iets mis op de server.", 500);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
