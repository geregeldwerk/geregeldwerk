import { calculateTotals, lineTotalCents } from "@/lib/domain/money";
import type { CompanySettings, Invoice, Quote } from "@/lib/domain/types";
import {
  compactVat,
  digitsOnly,
  isBelgianEnterpriseNumber,
  isBelgianVat,
  isDutchKvkCompact,
  isDutchVat,
  normalizeIban,
} from "@/lib/peppol/identifiers";
import { nextInvoiceNumber } from "@/lib/peppol/numbering";
import {
  addDays,
  amsterdamDate,
  percentFromRate,
  unitCodeFor,
  vatCentsFromTaxable,
} from "@/lib/peppol/spec";
import { buildUblInvoice, type UblParty, type VatCategoryCode } from "@/lib/peppol/ubl";
import { formatPeppolError, validatePeppolInvoice, type PeppolIssue } from "@/lib/peppol/validate";

export interface RenderedPeppolInvoice {
  xml: string;
  issues: PeppolIssue[];
  seller: UblParty;
  buyer: UblParty;
  taxableCents: number;
  taxCents: number;
  percent: number;
  category: VatCategoryCode;
  issueDate: string;
  dueDate: string;
  buyerReference: string;
}

export function renderPeppolInvoice(input: {
  number: string;
  issuedAt: Date;
  quote: Quote;
  settings: CompanySettings;
}): RenderedPeppolInvoice {
  const seller = sellerFromSettings(input.settings);
  const buyer = buyerFromQuote(input.quote);
  const treatment = taxTreatment(input.quote, seller.country === "BE" ? "BE" : "NL");
  const lines = input.quote.lines.map((line, index) => ({
    id: String(index + 1),
    name: line.description.trim(),
    quantity: line.quantity,
    unitCode: unitCodeFor(line.unit) ?? "",
    unitPriceCents: line.unitPriceCents ?? 0,
    netCents: line.unitPriceCents == null ? 0 : lineTotalCents(line.quantity, line.unitPriceCents),
    vatCategory: treatment.category,
    vatPercent: treatment.percent,
  }));
  const taxableCents = lines.reduce((sum, line) => sum + line.netCents, 0);
  const taxCents = treatment.category === "S" ? vatCentsFromTaxable(taxableCents, treatment.percent) : 0;
  const issueDate = amsterdamDate(input.issuedAt);
  const dueDate = addDays(issueDate, paymentTermDays(input.settings));
  const buyerReference = input.quote.buyerReference?.trim() || input.quote.number;
  const iban = normalizeIban(input.settings.iban);
  const xml = buildUblInvoice({
    number: input.number,
    issueDate,
    dueDate,
    buyerReference,
    seller,
    buyer,
    lines,
    iban,
    paymentMeansCode: iban ? "58" : "",
    taxCategory: treatment.category,
    taxPercent: treatment.percent,
    taxableCents,
    taxCents,
    exemptionReasonCode: treatment.exemptionReasonCode,
    exemptionReason: treatment.exemptionReason,
    deliveryDate: treatment.category === "K" ? issueDate : undefined,
    deliveryCountry: treatment.category === "K" && (buyer.country === "NL" || buyer.country === "BE") ? buyer.country : undefined,
  });
  return {
    xml,
    issues: validatePeppolInvoice(xml),
    seller,
    buyer,
    taxableCents,
    taxCents,
    percent: treatment.percent,
    category: treatment.category,
    issueDate,
    dueDate,
    buyerReference,
  };
}

export function createInvoiceFromQuote(input: {
  quote: Quote;
  settings: CompanySettings;
  existingNumbers: readonly string[];
  existingForQuote: boolean;
  now?: Date;
}): { ok: true; invoice: Invoice } | { ok: false; error: string; issues: PeppolIssue[] } {
  const now = input.now ?? new Date();
  if (input.quote.status !== "geaccepteerd") {
    return {
      ok: false,
      error: "Alleen een geaccepteerde offerte kan een factuur worden.",
      issues: [],
    };
  }
  if (input.existingForQuote) {
    return { ok: false, error: "Er is al een factuur voor deze offerte.", issues: [] };
  }
  const totals = calculateTotals(input.quote.lines, input.quote.vatRate);
  if (!totals.complete) {
    return { ok: false, error: "Factuur kan niet zonder volledige prijzen.", issues: [] };
  }

  const number = nextInvoiceNumber(input.existingNumbers, now);
  const rendered = renderPeppolInvoice({
    number,
    issuedAt: now,
    quote: input.quote,
    settings: input.settings,
  });
  if (rendered.issues.length > 0) {
    return { ok: false, error: formatPeppolError(rendered.issues), issues: rendered.issues };
  }

  const scenario = input.quote.vatScenario ?? "standaard";
  return {
    ok: true,
    invoice: {
      id: `invoice-${crypto.randomUUID()}`,
      number,
      quoteId: input.quote.id,
      customerName: input.quote.customerName,
      amountCents: rendered.taxableCents,
      vatCents: rendered.taxCents,
      totalCents: rendered.taxableCents + rendered.taxCents,
      createdAt: now.toISOString(),
      example: input.quote.example,
      simulated: true,
      issueDate: rendered.issueDate,
      dueDate: rendered.dueDate,
      vatScenario: scenario,
      vatRate: rendered.percent / 100,
      sellerCountry: rendered.seller.country === "BE" ? "BE" : "NL",
      buyerCountry: rendered.buyer.country === "BE" ? "BE" : "NL",
      sellerName: rendered.seller.name,
      buyerReference: rendered.buyerReference,
      sellerEndpointScheme: rendered.seller.endpointScheme,
      sellerEndpointId: rendered.seller.endpointId,
      buyerEndpointScheme: rendered.buyer.endpointScheme,
      buyerEndpointId: rendered.buyer.endpointId,
      lines: input.quote.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPriceCents: line.unitPriceCents ?? 0,
        lineCents: line.unitPriceCents == null ? 0 : lineTotalCents(line.quantity, line.unitPriceCents),
      })),
      ublXml: rendered.xml,
      sendStatus: "niet_verstuurd",
      sendProvider: null,
      transmissionId: null,
      sentAt: null,
      sendMessage: null,
    },
  };
}

function sellerFromSettings(settings: CompanySettings): UblParty {
  const country = settings.country === "BE" ? "BE" : "NL";
  const legalId = country === "BE" ? digitsOnly(settings.enterpriseNumber ?? "") : digitsOnly(settings.kvk);
  const scheme = country === "BE" ? "0208" : "0106";
  return {
    name: settings.companyName.trim(),
    street: settings.address.trim(),
    postalCode: settings.postalCode.trim(),
    city: settings.city.trim(),
    country,
    endpointScheme: legalId ? scheme : "",
    endpointId: legalId,
    vatNumber: compactVat(settings.btw),
    legalScheme: legalId ? scheme : "",
    legalId,
    email: settings.email.trim(),
    phone: settings.phone.trim(),
  };
}

function buyerFromQuote(quote: Quote): UblParty {
  const country = quote.customerCountry === "BE" ? "BE" : "NL";
  const legalId = digitsOnly(quote.customerLegalId ?? "");
  const vat = compactVat(quote.customerVat ?? "");
  const endpoint = resolveEndpoint({
    country,
    legalId,
    vat,
    requestedScheme: (quote.customerEndpointScheme ?? "").trim(),
    requestedId: (quote.customerEndpointId ?? "").trim(),
  });
  return {
    name: quote.customerName.trim(),
    street: (quote.customerStreet ?? "").trim(),
    postalCode: (quote.customerPostalCode ?? "").trim(),
    city: (quote.customerCity ?? "").trim(),
    country,
    endpointScheme: endpoint.scheme,
    endpointId: endpoint.id,
    vatNumber: vat,
    legalScheme: legalId ? (country === "BE" ? "0208" : "0106") : "",
    legalId,
    email: quote.customerEmail.trim(),
    phone: quote.customerPhone.trim(),
  };
}

function resolveEndpoint(input: {
  country: "NL" | "BE";
  legalId: string;
  vat: string;
  requestedScheme: string;
  requestedId: string;
}): { scheme: string; id: string } {
  const scheme = input.requestedScheme;
  if (scheme === "9944" || scheme === "9925") {
    return { scheme, id: compactVat(input.requestedId || input.vat) };
  }
  if (scheme === "0106" || scheme === "0190" || scheme === "0208") {
    return { scheme, id: digitsOnly(input.requestedId || input.legalId) };
  }
  if (scheme && input.requestedId) return { scheme, id: input.requestedId.replace(/\s/g, "") };
  if (input.country === "NL" && isDutchKvkCompact(input.legalId)) return { scheme: "0106", id: input.legalId };
  if (input.country === "BE" && isBelgianEnterpriseNumber(input.legalId)) return { scheme: "0208", id: input.legalId };
  if (input.country === "NL" && isDutchVat(input.vat)) return { scheme: "9944", id: input.vat };
  if (input.country === "BE" && isBelgianVat(input.vat)) return { scheme: "9925", id: input.vat };
  return { scheme: "", id: "" };
}

function taxTreatment(
  quote: Quote,
  sellerCountry: "NL" | "BE",
): { category: VatCategoryCode; percent: number; exemptionReasonCode?: string; exemptionReason?: string } {
  if (quote.vatScenario === "verlegd") {
    return {
      category: "AE",
      percent: 0,
      exemptionReasonCode: "VATEX-EU-AE",
      exemptionReason: sellerCountry === "BE" ? "BTW verlegd – medecontractant" : "Btw verlegd",
    };
  }
  if (quote.vatScenario === "intracommunautair") {
    return {
      category: "K",
      percent: 0,
      exemptionReasonCode: "VATEX-EU-IC",
      exemptionReason: "Intracommunautaire levering",
    };
  }
  const percent = percentFromRate(quote.vatRate);
  if (percent === 0) return { category: "Z", percent: 0 };
  return { category: "S", percent };
}

function paymentTermDays(settings: CompanySettings): number {
  const days = settings.paymentTermDays;
  if (typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 365) return days;
  return 14;
}
