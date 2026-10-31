import { connection } from "next/server";
import { parseDraftBody, parseStatus } from "@/lib/api/draft";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { updateQuote } from "@/lib/domain/quote";
import { assertDirectStatusChange, copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  const data = await getRepository().read();
  const quote = data.quotes.find((item) => item.id === id);
  if (!quote) return jsonError("Deze offerte bestaat niet.", 404);
  const pendingApprovals = data.approvals.filter(
    (item) =>
      item.status === "wacht_op_goedkeuring" &&
      "quoteId" in item.payload &&
      item.payload.quoteId === id,
  );
  return Response.json({ quote, pendingApprovals });
}

export async function PATCH(request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const draft = parseDraftBody(body);
    const status = parseStatus(body);
    assertDirectStatusChange(status);
    const repository = getRepository();
    const current = await repository.read();
    const existing = current.quotes.find((item) => item.id === id);
    if (!existing) return jsonError("Deze offerte bestaat niet.", 404);
    const quote = updateQuote(existing, { ...draft, status }, new Date());
    await repository.update((data) => {
      const index = data.quotes.findIndex((item) => item.id === id);
      if (index >= 0) data.quotes[index] = quote;
      copyStore(
        data,
        withAudit(data, {
          at: new Date().toISOString(),
          actor: OWNER,
          action: "offerte_bijgewerkt",
          outcome: "uitgevoerd",
          summary: `Offerte ${quote.number} bijgewerkt.`,
          input: { status: status ?? existing.status },
          output: { status: quote.status },
          before: { status: existing.status, customerName: existing.customerName },
          after: { status: quote.status, customerName: quote.customerName },
        }),
      );
    });
    return Response.json({ quote });
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  const repository = getRepository();
  const current = await repository.read();
  if (!current.quotes.some((item) => item.id === id)) {
    return jsonError("Deze offerte bestaat niet.", 404);
  }
  await repository.update((data) => {
    const before = data.quotes.find((item) => item.id === id) ?? null;
    data.quotes = data.quotes.filter((item) => item.id !== id);
    copyStore(
      data,
      withAudit(data, {
        at: new Date().toISOString(),
        actor: OWNER,
        action: "offerte_verwijderd",
        outcome: "uitgevoerd",
        summary: `Offerte ${before?.number ?? id} verwijderd.`,
        input: { id },
        output: null,
        before,
        after: null,
      }),
    );
  });
  return Response.json({ ok: true });
}
