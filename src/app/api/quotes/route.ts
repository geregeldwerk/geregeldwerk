import { connection } from "next/server";
import { parseCustomerChoice, parseDraftBody, parseFollowUp } from "@/lib/api/draft";
import { fromUnknownError, readJson } from "@/lib/api/http";
import { attachCustomerChoice } from "@/lib/domain/customers";
import { createQuote } from "@/lib/domain/quote";
import type { Task } from "@/lib/domain/types";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  const quotes = [...data.quotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return Response.json({ quotes });
}

export async function POST(request: Request) {
  await connection();
  try {
    const body = await readJson(request);
    const draft = parseDraftBody(body);
    const followUp = parseFollowUp(body);
    const choice = parseCustomerChoice(body);
    const now = new Date();
    const repository = getRepository();
    const current = await repository.read();
    const quote = createQuote(
      draft,
      current.quotes.map((item) => item.number),
      now,
    );
    let linkedCustomerId: string | null = null;
    const task: Task | null = followUp
      ? {
          id: crypto.randomUUID(),
          title: followUp.title,
          detail: followUp.detail,
          dueDate: null,
          done: false,
          quoteId: quote.id,
          customerId: null,
          example: false,
          createdAt: now.toISOString(),
        }
      : null;

    await repository.update((data) => {
      const linked = attachCustomerChoice(data, quote, choice, now);
      quote.customerId = linked.customerId;
      linkedCustomerId = linked.customerId;
      if (task) task.customerId = linked.customerId;
      data.quotes.unshift(quote);
      if (task) data.tasks.unshift(task);
      copyStore(
        data,
        withAudit(data, {
          at: now.toISOString(),
          actor: OWNER,
          action: "offerte_concept",
          outcome: "uitgevoerd",
          summary: `Conceptofferte ${quote.number} opgeslagen.`,
          input: { customerName: quote.customerName },
          output: { quoteId: quote.id, taskId: task?.id ?? null, customerId: linkedCustomerId },
          before: null,
          after: { number: quote.number, status: quote.status },
        }),
      );
    });

    return Response.json({ quote, task }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
