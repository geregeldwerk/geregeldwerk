import { connection } from "next/server";
import { customerQuoteSeed } from "@/lib/domain/customers";
import { createQuote } from "@/lib/domain/quote";
import { fromUnknownError, jsonError } from "@/lib/api/http";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const now = new Date();
    const repository = getRepository();
    const current = await repository.read();
    const customer = current.customers.find((item) => item.id === id);
    if (!customer) return jsonError("Deze klant bestaat niet.", 404);
    const quote = createQuote(
      customerQuoteSeed(customer, current.settings),
      current.quotes.map((item) => item.number),
      now,
    );
    await repository.update((data) => {
      data.quotes.unshift(quote);
      copyStore(
        data,
        withAudit(data, {
          at: now.toISOString(),
          actor: OWNER,
          action: "offerte_concept",
          outcome: "uitgevoerd",
          summary: `Conceptofferte ${quote.number} voor ${customer.name}.`,
          input: { customerId: customer.id },
          output: { quoteId: quote.id },
          before: null,
          after: { number: quote.number, status: quote.status },
        }),
      );
    });
    return Response.json({ quote }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
