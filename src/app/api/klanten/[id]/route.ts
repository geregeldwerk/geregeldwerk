import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import {
  buildTimeline,
  findCustomerByContact,
  parseCustomerBody,
  removeCustomer,
} from "@/lib/domain/customers";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  const data = await getRepository().read();
  const customer = data.customers.find((item) => item.id === id);
  if (!customer) return jsonError("Deze klant bestaat niet.", 404);
  return Response.json({
    customer,
    notes: data.customerNotes.filter((note) => note.customerId === id),
    quotes: data.quotes.filter((quote) => quote.customerId === id),
    invoices: data.invoices.filter((invoice) => invoice.customerId === id),
    tasks: data.tasks.filter((task) => task.customerId === id),
    appointments: data.appointments.filter((item) => item.customerId === id),
    timeline: buildTimeline(data, id),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const now = new Date();
    const repository = getRepository();
    const current = await repository.read();
    const existing = current.customers.find((item) => item.id === id);
    if (!existing) return jsonError("Deze klant bestaat niet.", 404);
    const draft = parseCustomerBody(await readJson(request), current.settings, now);
    const duplicate = findCustomerByContact(
      current.customers.filter((item) => item.id !== id),
      draft.email,
      draft.phone,
    );
    if (duplicate) {
      return jsonError(`Er is al een klant met dit e-mailadres of telefoonnummer: ${duplicate.name}.`, 409);
    }
    const customer = {
      ...existing,
      ...draft,
      id: existing.id,
      example: existing.example,
      sourceLeadId: existing.sourceLeadId,
      createdAt: existing.createdAt,
      updatedAt: now.toISOString(),
    };
    await repository.update((data) => {
      const index = data.customers.findIndex((item) => item.id === id);
      if (index >= 0) data.customers[index] = customer;
      copyStore(
        data,
        withAudit(data, {
          at: now.toISOString(),
          actor: OWNER,
          action: "klant_bijgewerkt",
          outcome: "uitgevoerd",
          summary: `Klantkaart ${customer.name} bijgewerkt.`,
          input: { pipelineStatus: customer.pipelineStatus },
          output: { customerId: customer.id, pipelineStatus: customer.pipelineStatus },
          before: { pipelineStatus: existing.pipelineStatus, name: existing.name },
          after: { pipelineStatus: customer.pipelineStatus, name: customer.name },
        }),
      );
    });
    return Response.json({ customer });
  } catch (error) {
    return fromUnknownError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const now = new Date();
    let message = "";
    let missing = false;
    await getRepository().update((data) => {
      const before = data.customers.find((item) => item.id === id) ?? null;
      const result = removeCustomer(data, id);
      if (!result.ok) {
        missing = true;
        return;
      }
      message = result.message;
      copyStore(
        data,
        withAudit(data, {
          at: now.toISOString(),
          actor: OWNER,
          action: "klant_verwijderd",
          outcome: "uitgevoerd",
          summary: result.message,
          input: { id },
          output: { message: result.message },
          before,
          after: null,
        }),
      );
    });
    if (missing) return jsonError("Deze klant bestaat niet.", 404);
    return Response.json({ ok: true, message });
  } catch (error) {
    return fromUnknownError(error);
  }
}
