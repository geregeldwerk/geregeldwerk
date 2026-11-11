import { connection } from "next/server";
import { QuoteInputError } from "@/lib/domain/quote";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import type { CustomerNote } from "@/lib/domain/types";
import { copyStore, withAudit } from "@/lib/oversight/engine";
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
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new QuoteInputError("Ongeldige aanvraag.");
    }
    const record = body as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text.trim().slice(0, 2000) : "";
    if (!text) throw new QuoteInputError("Een notitie heeft tekst nodig.");
    const quoteId = optionalLink(record.quoteId);
    const invoiceId = optionalLink(record.invoiceId);
    const now = new Date();
    const note: CustomerNote = {
      id: `note-${crypto.randomUUID()}`,
      customerId: id,
      text,
      at: now.toISOString(),
      quoteId,
      invoiceId,
      example: false,
    };
    let missing = false;
    await getRepository().update((data) => {
      if (!data.customers.some((customer) => customer.id === id)) {
        missing = true;
        return;
      }
      data.customerNotes.unshift(note);
      copyStore(
        data,
        withAudit(data, {
          at: now.toISOString(),
          actor: OWNER,
          action: "klant_notitie",
          outcome: "uitgevoerd",
          summary: "Notitie op de klantkaart gezet.",
          input: { customerId: id, quoteId, invoiceId },
          output: { noteId: note.id },
          before: null,
          after: note,
        }),
      );
    });
    if (missing) return jsonError("Deze klant bestaat niet.", 404);
    return Response.json({ note }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}

function optionalLink(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new QuoteInputError("Verwijzing is ongeldig.");
  return value.slice(0, 80);
}
