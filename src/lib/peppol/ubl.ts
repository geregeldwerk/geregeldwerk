import type { CountryCode } from "@/lib/domain/types";
import {
  CAC_NS,
  CBC_NS,
  CUSTOMIZATION_ID,
  INVOICE_NS,
  PROFILE_ID,
  escapeXml,
  formatMoney,
  formatPercent,
  formatQuantity,
} from "@/lib/peppol/spec";

export type VatCategoryCode = "S" | "Z" | "AE" | "K";

export interface UblParty {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: CountryCode | "";
  endpointScheme: string;
  endpointId: string;
  vatNumber: string;
  legalScheme: string;
  legalId: string;
  email: string;
  phone: string;
}

export interface UblLine {
  id: string;
  name: string;
  quantity: number;
  unitCode: string;
  unitPriceCents: number;
  netCents: number;
  vatCategory: VatCategoryCode;
  vatPercent: number;
}

export interface UblInvoiceInput {
  number: string;
  issueDate: string;
  dueDate: string;
  buyerReference: string;
  seller: UblParty;
  buyer: UblParty;
  lines: UblLine[];
  currency?: "EUR";
  iban: string;
  paymentMeansCode: string;
  taxCategory: VatCategoryCode;
  taxPercent: number;
  taxableCents: number;
  taxCents: number;
  exemptionReasonCode?: string;
  exemptionReason?: string;
  deliveryDate?: string;
  deliveryCountry?: CountryCode;
}

export function buildUblInvoice(input: UblInvoiceInput): string {
  const lineExtension = input.lines.reduce((sum, line) => sum + line.netCents, 0);
  const taxExclusive = lineExtension;
  const taxInclusive = taxExclusive + input.taxCents;
  const invoice = block(
    "Invoice",
    [
      textEl("cbc:CustomizationID", CUSTOMIZATION_ID),
      textEl("cbc:ProfileID", PROFILE_ID),
      textEl("cbc:ID", input.number),
      textEl("cbc:IssueDate", input.issueDate),
      input.dueDate ? textEl("cbc:DueDate", input.dueDate) : "",
      textEl("cbc:InvoiceTypeCode", "380"),
      textEl("cbc:DocumentCurrencyCode", "EUR"),
      input.buyerReference ? textEl("cbc:BuyerReference", input.buyerReference) : "",
      partyBlock("cac:AccountingSupplierParty", input.seller),
      partyBlock("cac:AccountingCustomerParty", input.buyer),
      input.deliveryDate && input.deliveryCountry ? deliveryBlock(input.deliveryDate, input.deliveryCountry) : "",
      input.iban && input.paymentMeansCode ? paymentBlock(input) : "",
      taxTotalBlock(input),
      block("cac:LegalMonetaryTotal", [
        moneyEl("cbc:LineExtensionAmount", lineExtension),
        moneyEl("cbc:TaxExclusiveAmount", taxExclusive),
        moneyEl("cbc:TaxInclusiveAmount", taxInclusive),
        moneyEl("cbc:PayableAmount", taxInclusive),
      ]),
      ...input.lines.map(lineBlock),
    ],
    {
      xmlns: INVOICE_NS,
      "xmlns:cac": CAC_NS,
      "xmlns:cbc": CBC_NS,
    },
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${invoice}\n`;
}

function partyBlock(tag: string, party: UblParty): string {
  return block(tag, [
    block("cac:Party", [
      party.endpointScheme && party.endpointId
        ? textEl("cbc:EndpointID", party.endpointId, { schemeID: party.endpointScheme })
        : "",
      party.name ? block("cac:PartyName", [textEl("cbc:Name", party.name)]) : "",
      block("cac:PostalAddress", [
        party.street ? textEl("cbc:StreetName", party.street) : "",
        party.city ? textEl("cbc:CityName", party.city) : "",
        party.postalCode ? textEl("cbc:PostalZone", party.postalCode) : "",
        party.country
          ? block("cac:Country", [textEl("cbc:IdentificationCode", party.country)])
          : "",
      ]),
      party.vatNumber
        ? block("cac:PartyTaxScheme", [
            textEl("cbc:CompanyID", party.vatNumber),
            block("cac:TaxScheme", [textEl("cbc:ID", "VAT")]),
          ])
        : "",
      party.name
        ? block("cac:PartyLegalEntity", [
            textEl("cbc:RegistrationName", party.name),
            party.legalScheme && party.legalId
              ? textEl("cbc:CompanyID", party.legalId, { schemeID: party.legalScheme })
              : "",
          ])
        : "",
      party.email || party.phone
        ? block("cac:Contact", [
            party.phone ? textEl("cbc:Telephone", party.phone) : "",
            party.email ? textEl("cbc:ElectronicMail", party.email) : "",
          ])
        : "",
    ]),
  ]);
}

function deliveryBlock(date: string, country: CountryCode): string {
  return block("cac:Delivery", [
    textEl("cbc:ActualDeliveryDate", date),
    block("cac:DeliveryLocation", [
      block("cac:Address", [block("cac:Country", [textEl("cbc:IdentificationCode", country)])]),
    ]),
  ]);
}

function paymentBlock(input: UblInvoiceInput): string {
  return block("cac:PaymentMeans", [
    textEl("cbc:PaymentMeansCode", input.paymentMeansCode),
    textEl("cbc:PaymentID", input.number),
    block("cac:PayeeFinancialAccount", [textEl("cbc:ID", input.iban)]),
  ]);
}

function taxTotalBlock(input: UblInvoiceInput): string {
  return block("cac:TaxTotal", [
    moneyEl("cbc:TaxAmount", input.taxCents),
    block("cac:TaxSubtotal", [
      moneyEl("cbc:TaxableAmount", input.taxableCents),
      moneyEl("cbc:TaxAmount", input.taxCents),
      block("cac:TaxCategory", [
        textEl("cbc:ID", input.taxCategory),
        textEl("cbc:Percent", formatPercent(input.taxPercent)),
        input.exemptionReasonCode ? textEl("cbc:TaxExemptionReasonCode", input.exemptionReasonCode) : "",
        input.exemptionReason ? textEl("cbc:TaxExemptionReason", input.exemptionReason) : "",
        block("cac:TaxScheme", [textEl("cbc:ID", "VAT")]),
      ]),
    ]),
  ]);
}

function lineBlock(line: UblLine): string {
  return block("cac:InvoiceLine", [
    textEl("cbc:ID", line.id),
    textEl("cbc:InvoicedQuantity", formatQuantity(line.quantity), { unitCode: line.unitCode }),
    moneyEl("cbc:LineExtensionAmount", line.netCents),
    block("cac:Item", [
      textEl("cbc:Name", line.name),
      block("cac:ClassifiedTaxCategory", [
        textEl("cbc:ID", line.vatCategory),
        textEl("cbc:Percent", formatPercent(line.vatPercent)),
        block("cac:TaxScheme", [textEl("cbc:ID", "VAT")]),
      ]),
    ]),
    block("cac:Price", [moneyEl("cbc:PriceAmount", line.unitPriceCents)]),
  ]);
}

function moneyEl(name: string, cents: number): string {
  return textEl(name, formatMoney(cents), { currencyID: "EUR" });
}

function textEl(name: string, value: string, attrs?: Record<string, string>): string {
  return `<${name}${attrString(attrs)}>${escapeXml(value)}</${name}>`;
}

function block(name: string, inner: Array<string | false>, attrs?: Record<string, string>): string {
  const children = inner.filter((item): item is string => Boolean(item));
  if (children.length === 0) return "";
  const body = children
    .map((child) =>
      child
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n"),
    )
    .join("\n");
  return `<${name}${attrString(attrs)}>\n${body}\n</${name}>`;
}

function attrString(attrs?: Record<string, string>): string {
  if (!attrs) return "";
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join("");
}
