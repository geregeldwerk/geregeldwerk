import { connection } from "next/server";
import { jsonError } from "@/lib/api/http";
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
