import { connection } from "next/server";
import { parseTaskBody } from "@/lib/api/draft";
import { fromUnknownError, readJson } from "@/lib/api/http";
import type { Task } from "@/lib/domain/types";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  const tasks = [...data.tasks].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt));
  return Response.json({
    tasks,
    appointments: data.appointments,
    quotes: data.quotes.map((quote) => ({ id: quote.id, number: quote.number, customerName: quote.customerName })),
  });
}

export async function POST(request: Request) {
  await connection();
  try {
    const input = parseTaskBody(await readJson(request));
    const task: Task = {
      id: crypto.randomUUID(),
      title: input.title,
      detail: input.detail,
      dueDate: input.dueDate,
      quoteId: input.quoteId,
      done: false,
      example: false,
      createdAt: new Date().toISOString(),
    };
    await getRepository().update((data) => {
      data.tasks.unshift(task);
      copyStore(
        data,
        withAudit(data, {
          at: task.createdAt,
          actor: OWNER,
          action: "taak_aangemaakt",
          outcome: "uitgevoerd",
          summary: task.title,
          input: input,
          output: task,
          before: null,
          after: task,
        }),
      );
    });
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
