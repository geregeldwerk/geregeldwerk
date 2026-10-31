import { connection } from "next/server";
import { fromUnknownError, jsonError } from "@/lib/api/http";
import { renderPeppolInvoice } from "@/lib/peppol/invoice";
import { resolvePeppolProvider } from "@/lib/peppol/provider";
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
    const repository = getRepository();
    const current = await repository.read();
    const invoice = current.invoices.find((item) => item.id === id);
    if (!invoice) return jsonError("Deze factuur bestaat niet.", 404);
    if (invoice.sendStatus === "verstuurd_mock") {
      return Response.json({
        invoice,
        result: {
          ok: true,
          provider: invoice.sendProvider ?? "mock",
          transmissionId: invoice.transmissionId,
          message: "Deze factuur is al via de mock-provider verstuurd. Er is niets opnieuw verstuurd.",
        },
      });
    }

    const quote = current.quotes.find((item) => item.id === invoice.quoteId) ?? null;
    const rendered =
      quote && !invoice.ublXml
        ? renderPeppolInvoice({
            number: invoice.number,
            issuedAt: new Date(invoice.createdAt),
            quote,
            settings: current.settings,
          })
        : null;
    const xml = invoice.ublXml ?? rendered?.xml ?? null;
    if (!xml) return jsonError("Er is geen UBL en de bijbehorende offerte ontbreekt.", 404);

    const provider = resolvePeppolProvider();
    const result = await provider.send({
      invoiceNumber: invoice.number,
      senderScheme: invoice.sellerEndpointScheme || rendered?.seller.endpointScheme || "",
      senderId: invoice.sellerEndpointId || rendered?.seller.endpointId || "",
      receiverScheme: invoice.buyerEndpointScheme || rendered?.buyer.endpointScheme || "",
      receiverId: invoice.buyerEndpointId || rendered?.buyer.endpointId || "",
      xml,
    });

    let saved = invoice;
    await repository.update((data) => {
      const target = data.invoices.find((item) => item.id === id);
      if (!target) return;
      target.sendStatus = result.ok ? "verstuurd_mock" : "mislukt";
      target.sendProvider = result.provider;
      target.transmissionId = result.transmissionId;
      target.sentAt = result.ok ? new Date().toISOString() : (target.sentAt ?? null);
      target.sendMessage = result.message;
      if (result.ok && !target.ublXml) target.ublXml = xml;
      saved = structuredClone(target);
      copyStore(
        data,
        withAudit(data, {
          at: new Date().toISOString(),
          actor: OWNER,
          action: "factuur_versturen_mock",
          outcome: result.ok ? "uitgevoerd" : "fout",
          summary: result.ok
            ? `Factuur ${target.number} gesimuleerd verstuurd via ${result.provider}.`
            : `Factuur ${target.number} is niet verstuurd.`,
          input: { invoiceId: id, provider: provider.id },
          output: { transmissionId: result.transmissionId, provider: result.provider },
          before: { sendStatus: invoice.sendStatus ?? "niet_verstuurd" },
          after: { sendStatus: target.sendStatus },
          error: result.ok ? null : result.message,
        }),
      );
    });

    if (!result.ok) return jsonError(result.message, 400);
    return Response.json({ invoice: saved, result });
  } catch (error) {
    return fromUnknownError(error);
  }
}
