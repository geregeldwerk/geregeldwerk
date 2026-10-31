import { connection } from "next/server";
import { parseDraftBody, parseFollowUp } from "@/lib/api/draft";
import { fromUnknownError, readJson } from "@/lib/api/http";
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
    const now = new Date();
    const repository = getRepository();
    const current = await repository.read();
    const quote = createQuote(
      draft,
      current.quotes.map((item) => item.number),
      now,
    );
    const task: Task | null = followUp
      ? {
          id: crypto.randomUUID(),
          title: followUp.title,
          detail: followUp.detail,
          dueDate: null,
          done: false,
          quoteId: quote.id,
          example: false,
          createdAt: now.toISOString(),
        }
      : null;

    await repository.update((data) => {
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
          output: { quoteId: quote.id, taskId: task?.id ?? null },
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
