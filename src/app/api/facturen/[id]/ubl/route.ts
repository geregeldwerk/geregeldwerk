import { connection } from "next/server";
import { jsonError } from "@/lib/api/http";
import { renderPeppolInvoice } from "@/lib/peppol/invoice";
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
  const xml =
    invoice.ublXml ??
    (quote
      ? renderPeppolInvoice({
          number: invoice.number,
          issuedAt: new Date(invoice.createdAt),
          quote,
          settings: data.settings,
        }).xml
      : null);
  if (!xml) {
    return jsonError("Er is geen UBL en de bijbehorende offerte ontbreekt.", 404);
  }
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoice.number}.xml"`,
      "Cache-Control": "no-store",
    },
  });
}
