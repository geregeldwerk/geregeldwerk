import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { createCustomer, findCustomerByContact, parseCustomerBody } from "@/lib/domain/customers";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  const customers = [...data.customers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, "nl"));
  return Response.json({ customers });
}

export async function POST(request: Request) {
  await connection();
  try {
    const now = new Date();
    const current = await getRepository().read();
    const draft = parseCustomerBody(await readJson(request), current.settings, now);
    const duplicate = findCustomerByContact(current.customers, draft.email, draft.phone);
    if (duplicate) {
      return jsonError(`Er is al een klant met dit e-mailadres of telefoonnummer: ${duplicate.name}.`, 409);
    }
    const customer = createCustomer(draft, now);
    await getRepository().update((data) => {
      data.customers.unshift(customer);
      copyStore(
        data,
        withAudit(data, {
          at: now.toISOString(),
          actor: OWNER,
          action: "klant_aangemaakt",
          outcome: "uitgevoerd",
          summary: `Klantkaart ${customer.name} aangemaakt.`,
          input: { name: customer.name, pipelineStatus: customer.pipelineStatus },
          output: { customerId: customer.id },
          before: null,
          after: { id: customer.id, pipelineStatus: customer.pipelineStatus },
        }),
      );
    });
    return Response.json({ customer }, { status: 201 });
  } catch (error) {
    return fromUnknownError(error);
  }
}
