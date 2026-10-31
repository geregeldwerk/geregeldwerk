import { describe, expect, it } from "vitest";
import type { CompanySettings, Quote } from "@/lib/domain/types";
import { createInvoiceFromQuote } from "@/lib/peppol/invoice";
import { validatePeppolInvoice } from "@/lib/peppol/validate";
import { createSeedSettings } from "@/lib/storage/seed";

const NOW = new Date("2026-03-18T09:00:00.000Z");

function enterprise(first8: string): string {
  const check = 97 - (Number(first8) % 97);
  return `${first8}${String(check).padStart(2, "0")}`;
}

function validXml(): string {
  const settings: CompanySettings = {
    ...createSeedSettings(),
    country: "NL",
    kvk: "12345678",
    btw: "NL123456789B01",
    iban: "NL91ABNA0417164300",
    paymentTermDays: 14,
  };
  const quote: Quote = {
    id: "q",
    number: "OFF-2026-010",
    status: "geaccepteerd",
    example: false,
    customerName: "Klant Voorbeeld",
    customerPhone: "",
    customerEmail: "",
    location: "Hulst",
    customerCountry: "NL",
    customerStreet: "Kerkstraat 1",
    customerPostalCode: "4561 AA",
    customerCity: "Hulst",
    customerVat: "NL987654321B01",
    customerLegalId: "87654321",
    buyerReference: "PO-100",
    vatScenario: "standaard",
    jobDescription: "Werk",
    requestedDate: "",
    sourceText: "",
    lines: [{ id: "l1", description: "Werk", quantity: 1, unit: "stuk", unitPriceCents: 10000 }],
    notes: "",
    vatRate: 0.21,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
  const created = createInvoiceFromQuote({
    quote,
    settings,
    existingNumbers: [],
    existingForQuote: false,
    now: NOW,
  });
  if (!created.ok) throw new Error(created.error);
  return created.invoice.ublXml ?? "";
}

describe("Peppol-validatie", () => {
  it("keurt een geldige NL-factuur goed", () => {
    expect(validatePeppolInvoice(validXml())).toEqual([]);
  });

  it("meldt een ontbrekend koper-endpoint in het Nederlands", () => {
    const xml = validXml().replace(/<cbc:EndpointID schemeID="0106">87654321<\/cbc:EndpointID>\n\s*/, "");
    const issues = validatePeppolInvoice(xml);
    expect(issues.some((issue) => issue.rule === "PEPPOL-EN16931-R010")).toBe(true);
    expect(issues.map((issue) => issue.message).join(" ")).toMatch(/elektronisch adres.*koper/i);
  });

  it("weigert een Belgisch ondernemingsnummer zonder geldige controlecijfers", () => {
    const seller = enterprise("01234567");
    const xml = validXml()
      .replaceAll("12345678", "0000000000")
      .replaceAll("NL123456789B01", `BE${seller}`)
      .replaceAll("<cbc:IdentificationCode>NL</cbc:IdentificationCode>", "<cbc:IdentificationCode>BE</cbc:IdentificationCode>")
      .replaceAll('schemeID="0106"', 'schemeID="0208"');
    const issues = validatePeppolInvoice(xml);
    expect(issues.some((issue) => issue.rule === "PEPPOL-COMMON-R043")).toBe(true);
    expect(issues.map((issue) => issue.message).join(" ")).toMatch(/ondernemingsnummer/);
  });

  it("weigert een Nederlands tarief dat niet 21, 9 of 0 procent is", () => {
    const settings: CompanySettings = {
      ...createSeedSettings(),
      kvk: "12345678",
      btw: "NL123456789B01",
      iban: "NL91ABNA0417164300",
      country: "NL",
    };
    const created = createInvoiceFromQuote({
      quote: {
        id: "q12",
        number: "OFF-2026-012",
        status: "geaccepteerd",
        example: false,
        customerName: "Klant Voorbeeld",
        customerPhone: "",
        customerEmail: "",
        location: "Hulst",
        customerCountry: "NL",
        customerStreet: "Kerkstraat 1",
        customerPostalCode: "4561 AA",
        customerCity: "Hulst",
        customerVat: "NL987654321B01",
        customerLegalId: "87654321",
        vatScenario: "standaard",
        jobDescription: "",
        requestedDate: "",
        sourceText: "",
        lines: [{ id: "l1", description: "Werk", quantity: 1, unit: "stuk", unitPriceCents: 10000 }],
        notes: "",
        vatRate: 0.12,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
      settings,
      existingNumbers: [],
      existingForQuote: false,
      now: NOW,
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error).toMatch(/Nederlandse verkoper/);
    expect(created.error).toMatch(/12%/);
    expect(created.issues.some((issue) => issue.rule === "GW-BTW-01")).toBe(true);
  });

  it("weigert verlegde btw zonder btw-nummer van de koper", () => {
    const xml = validXml()
      .replaceAll("<cbc:ID>S</cbc:ID>", "<cbc:ID>AE</cbc:ID>")
      .replaceAll("<cbc:Percent>21</cbc:Percent>", "<cbc:Percent>0</cbc:Percent>")
      .replaceAll(">21.00</cbc:TaxAmount>", ">0.00</cbc:TaxAmount>")
      .replaceAll(">121.00</cbc:TaxInclusiveAmount>", ">100.00</cbc:TaxInclusiveAmount>")
      .replaceAll(">121.00</cbc:PayableAmount>", ">100.00</cbc:PayableAmount>")
      .replace(
        "<cac:TaxScheme>\n        <cbc:ID>VAT</cbc:ID>\n      </cac:TaxScheme>\n    </cac:TaxCategory>",
        "<cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>\n        <cbc:TaxExemptionReason>Btw verlegd</cbc:TaxExemptionReason>\n        <cac:TaxScheme>\n        <cbc:ID>VAT</cbc:ID>\n      </cac:TaxScheme>\n    </cac:TaxCategory>",
      )
      .replace("<cbc:CompanyID>NL987654321B01</cbc:CompanyID>", "");
    const issues = validatePeppolInvoice(xml);
    expect(issues.some((issue) => issue.rule === "BR-AE-02")).toBe(true);
    expect(issues.map((issue) => issue.message).join(" ")).toMatch(/verlegde btw/i);
  });

  it("weigert een leeg element en onleesbare XML", () => {
    const empty = validXml().replace("</Invoice>", "<cbc:Note></cbc:Note>\n</Invoice>");
    const emptyIssues = validatePeppolInvoice(empty);
    expect(emptyIssues.some((issue) => issue.rule === "PEPPOL-EN16931-R008")).toBe(true);
    expect(emptyIssues.map((issue) => issue.message).join(" ")).toMatch(/leeg/i);

    const broken = validatePeppolInvoice("<<geen xml");
    expect(broken[0]?.rule).toBe("GW-XML-01");
    expect(broken[0]?.message).toMatch(/niet leesbaar/);
  });
});
