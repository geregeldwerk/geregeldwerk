import { connection } from "next/server";
import { fromUnknownError, jsonError, readJson } from "@/lib/api/http";
import { PAYMENT_STATUSES, type PaymentStatus } from "@/lib/domain/types";
import { copyStore, withAudit } from "@/lib/oversight/engine";
import { OWNER } from "@/lib/oversight/permissions";
import { renderPeppolInvoice } from "@/lib/peppol/invoice";
import { validatePeppolInvoice, type PeppolIssue } from "@/lib/peppol/validate";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  const data = await getRepository().read();
  const invoice = data.invoices.find((item) => item.id === id);
  if (!invoice) return jsonError("Deze factuur bestaat niet.", 404);
  const quote = data.quotes.find((item) => item.id === invoice.quoteId) ?? null;
  const rendered =
    !invoice.ublXml && quote
      ? renderPeppolInvoice({
          number: invoice.number,
          issuedAt: new Date(invoice.createdAt),
          quote,
          settings: data.settings,
        })
      : null;
  const xml = invoice.ublXml ?? rendered?.xml ?? null;
  const issues: PeppolIssue[] = xml
    ? validatePeppolInvoice(xml)
    : [
        {
          rule: "GW-XML-01",
          message: "Er is geen UBL en de bijbehorende offerte ontbreekt, dus de factuur kan niet worden opgebouwd.",
        },
      ];
  return Response.json({
    invoice,
    quote,
    xmlAvailable: Boolean(xml),
    validation: { ok: issues.length === 0, issues },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  await connection();
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const paymentStatus =
      typeof body === "object" && body !== null && "paymentStatus" in body
        ? (body as { paymentStatus: unknown }).paymentStatus
        : undefined;
    if (typeof paymentStatus !== "string" || !(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) {
      return jsonError("Onbekende betaalstatus.");
    }
    const now = new Date().toISOString();
    let missing = false;
    await getRepository().update((data) => {
      const invoice = data.invoices.find((item) => item.id === id);
      if (!invoice) {
        missing = true;
        return;
      }
      const before = invoice.paymentStatus ?? "open";
      invoice.paymentStatus = paymentStatus as PaymentStatus;
      invoice.paymentUpdatedAt = now;
      copyStore(
        data,
        withAudit(data, {
          at: now,
          actor: OWNER,
          action: "factuur_betaalstatus",
          outcome: "uitgevoerd",
          summary: `Betaalstatus van ${invoice.number} staat op ${paymentStatus}.`,
          input: { paymentStatus },
          output: { paymentStatus },
          before: { paymentStatus: before },
          after: { paymentStatus, paymentUpdatedAt: now },
        }),
      );
    });
    if (missing) return jsonError("Deze factuur bestaat niet.", 404);
    const data = await getRepository().read();
    const invoice = data.invoices.find((item) => item.id === id);
    return Response.json({ invoice });
  } catch (error) {
    return fromUnknownError(error);
  }
}
