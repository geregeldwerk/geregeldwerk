import { connection } from "next/server";
import { parseTaskPatch } from "@/lib/api/draft";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const patch = parseTaskPatch(await readJson(request));
    const repository = getRepository();
    const current = await repository.read();
    const existing = current.tasks.find((task) => task.id === id);
    if (!existing) return jsonError("Deze taak bestaat niet.", 404);
    const task = { ...existing, ...patch };
    await repository.update((data) => {
      const index = data.tasks.findIndex((item) => item.id === id);
      if (index >= 0) data.tasks[index] = task;
      copyStore(
        data,
        withAudit(data, {
          at: new Date().toISOString(),
          actor: OWNER,
          action: "taak_bijgewerkt",
          outcome: "uitgevoerd",
          summary: task.title,
          input: patch,
          output: task,
          before: existing,
          after: task,
        }),
      );
    });
    return Response.json({ task });
  } catch (error) {
    return fromUnknownError(error);
  }
}
