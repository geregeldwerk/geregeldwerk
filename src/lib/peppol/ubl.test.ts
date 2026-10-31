import { describe, expect, it } from "vitest";
import type { CompanySettings, Quote } from "@/lib/domain/types";
import { isBelgianEnterpriseNumber, isValidIban } from "@/lib/peppol/identifiers";
import { createInvoiceFromQuote } from "@/lib/peppol/invoice";
import { nextInvoiceNumber } from "@/lib/peppol/numbering";
import { createMockAccessPoint, resolvePeppolProvider } from "@/lib/peppol/provider";
import { CUSTOMIZATION_ID, PROFILE_ID } from "@/lib/peppol/spec";
import { validatePeppolInvoice } from "@/lib/peppol/validate";
import { requestAction } from "@/lib/oversight/engine";
import { defaultPermissions, OWNER } from "@/lib/oversight/permissions";
import { createSeedSettings } from "@/lib/storage/seed";

const NOW = new Date("2026-03-18T09:00:00.000Z");

function enterprise(first8: string): string {
  const check = 97 - (Number(first8) % 97);
  return `${first8}${String(check).padStart(2, "0")}`;
}

const BE_SELLER = enterprise("01234567");
const BE_BUYER = enterprise("04409663");

function settings(partial: Partial<CompanySettings> = {}): CompanySettings {
  return {
    ...createSeedSettings(),
    country: "NL",
    kvk: "12345678",
    btw: "NL123456789B01",
    iban: "NL91ABNA0417164300",
    paymentTermDays: 14,
    enterpriseNumber: "",
    ...partial,
  };
}

function quote(partial: Partial<Quote> = {}): Quote {
  return {
    id: "q-nl",
    number: "OFF-2026-010",
    status: "geaccepteerd",
    example: false,
    customerName: "Klant Voorbeeld",
    customerPhone: "0612345678",
    customerEmail: "klant@example.test",
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
    sourceText: "fictief",
    lines: [
      {
        id: "l1",
        description: "Radiator vervangen",
        quantity: 1,
        unit: "stuk",
        unitPriceCents: 10000,
      },
    ],
    notes: "",
    vatRate: 0.21,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...partial,
  };
}

function invoiceXml(partialQuote: Partial<Quote> = {}, partialSettings: Partial<CompanySettings> = {}, numbers: string[] = []) {
  const created = createInvoiceFromQuote({
    quote: quote(partialQuote),
    settings: settings(partialSettings),
    existingNumbers: numbers,
    existingForQuote: false,
    now: NOW,
  });
  return created;
}

describe("factuurnummers per bedrijf", () => {
  const now = new Date("2026-06-01T10:00:00.000Z");

  it("loopt door vanaf het hoogste nummer en hergebruikt geen gat", () => {
    expect(nextInvoiceNumber(["FAC-2026-001"], now)).toBe("FAC-2026-002");
    expect(nextInvoiceNumber(["FAC-2026-001", "FAC-2026-003"], now)).toBe("FAC-2026-004");
    expect(nextInvoiceNumber(["FAC-2026-001"], new Date("2027-01-02T10:00:00.000Z"))).toBe("FAC-2027-001");
  });

  it("houdt de reeks van elk bedrijf apart", () => {
    expect(nextInvoiceNumber(["FAC-2026-005"], now)).toBe("FAC-2026-006");
    expect(nextInvoiceNumber([], now)).toBe("FAC-2026-001");
  });
});

describe("UBL Peppol BIS Billing 3.0", () => {
  it("maakt een Nederlandse standaardfactuur op 21%", () => {
    expect(isValidIban("NL91ABNA0417164300")).toBe(true);
    const created = invoiceXml();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const xml = created.invoice.ublXml ?? "";
    expect(created.invoice.number).toBe("FAC-2026-001");
    expect(created.invoice.vatCents).toBe(2100);
    expect(created.invoice.totalCents).toBe(12100);
    expect(xml).toContain(CUSTOMIZATION_ID);
    expect(xml).toContain(PROFILE_ID);
    expect(xml).toContain('schemeID="0106">12345678</cbc:EndpointID>');
    expect(xml).toContain('schemeID="0106">87654321</cbc:EndpointID>');
    expect(xml).toContain("<cbc:ID>S</cbc:ID>");
    expect(xml).toContain("<cbc:Percent>21</cbc:Percent>");
    expect(xml).toContain(">100.00</cbc:LineExtensionAmount>");
    expect(xml).toContain(">21.00</cbc:TaxAmount>");
    expect(xml).toContain(">121.00</cbc:PayableAmount>");
    expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
    expect(validatePeppolInvoice(xml)).toEqual([]);
  });

  it("maakt een Belgische standaardfactuur op 21% en ondersteunt 6%", () => {
    expect(isBelgianEnterpriseNumber(BE_SELLER)).toBe(true);
    expect(isBelgianEnterpriseNumber(BE_BUYER)).toBe(true);
    const created = invoiceXml(
      {
        customerCountry: "BE",
        customerStreet: "Veldstraat 4",
        customerPostalCode: "9000",
        customerCity: "Gent",
        customerVat: `BE${BE_BUYER}`,
        customerLegalId: BE_BUYER,
        customerEndpointScheme: "0208",
      },
      {
        country: "BE",
        enterpriseNumber: BE_SELLER,
        btw: `BE${BE_SELLER}`,
        iban: "BE71096123456769",
      },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const xml = created.invoice.ublXml ?? "";
    expect(xml).toContain(`schemeID="0208">${BE_SELLER}</cbc:EndpointID>`);
    expect(xml).toContain(`schemeID="0208">${BE_BUYER}</cbc:EndpointID>`);
    expect(xml).toContain(`<cbc:CompanyID>BE${BE_SELLER}</cbc:CompanyID>`);
    expect(xml).toContain("<cbc:IdentificationCode>BE</cbc:IdentificationCode>");
    expect(xml).toContain("<cbc:Percent>21</cbc:Percent>");
    expect(validatePeppolInvoice(xml)).toEqual([]);

    const reduced = invoiceXml(
      {
        customerCountry: "BE",
        customerStreet: "Veldstraat 4",
        customerPostalCode: "9000",
        customerCity: "Gent",
        customerVat: `BE${BE_BUYER}`,
        customerLegalId: BE_BUYER,
        vatRate: 0.06,
      },
      {
        country: "BE",
        enterpriseNumber: BE_SELLER,
        btw: `BE${BE_SELLER}`,
        iban: "BE71096123456769",
      },
    );
    expect(reduced.ok).toBe(true);
    if (!reduced.ok) return;
    expect(reduced.invoice.ublXml).toContain("<cbc:Percent>6</cbc:Percent>");
    expect(reduced.invoice.vatCents).toBe(600);
    expect(validatePeppolInvoice(reduced.invoice.ublXml ?? "")).toEqual([]);
  });

  it("zet verlegde btw en medecontractant om naar categorie AE", () => {
    const shifted = invoiceXml({ vatScenario: "verlegd", vatRate: 0.21 });
    expect(shifted.ok).toBe(true);
    if (!shifted.ok) return;
    const xml = shifted.invoice.ublXml ?? "";
    expect(xml).toContain("<cbc:ID>AE</cbc:ID>");
    expect(xml).toContain("<cbc:Percent>0</cbc:Percent>");
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>");
    expect(xml).toContain("<cbc:TaxExemptionReason>Btw verlegd</cbc:TaxExemptionReason>");
    expect(xml).toContain("<cbc:CompanyID>NL987654321B01</cbc:CompanyID>");
    expect(xml).toContain(">0.00</cbc:TaxAmount>");
    expect(shifted.invoice.vatCents).toBe(0);
    expect(shifted.invoice.totalCents).toBe(10000);
    expect(validatePeppolInvoice(xml)).toEqual([]);

    const medecontractant = invoiceXml(
      {
        vatScenario: "verlegd",
        customerCountry: "BE",
        customerStreet: "Veldstraat 4",
        customerPostalCode: "9000",
        customerCity: "Gent",
        customerVat: `BE${BE_BUYER}`,
        customerLegalId: BE_BUYER,
      },
      {
        country: "BE",
        enterpriseNumber: BE_SELLER,
        btw: `BE${BE_SELLER}`,
        iban: "BE71096123456769",
      },
    );
    expect(medecontractant.ok).toBe(true);
    if (!medecontractant.ok) return;
    expect(medecontractant.invoice.ublXml).toContain("medecontractant");
    expect(validatePeppolInvoice(medecontractant.invoice.ublXml ?? "")).toEqual([]);
  });

  it("weigert een tweede factuur en een offerte die niet geaccepteerd is", () => {
    const duplicate = createInvoiceFromQuote({
      quote: quote(),
      settings: settings(),
      existingNumbers: ["FAC-2026-001"],
      existingForQuote: true,
      now: NOW,
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error).toMatch(/al een factuur/);

    const sent = invoiceXml({ status: "verstuurd" });
    expect(sent.ok).toBe(false);
    if (sent.ok) return;
    expect(sent.error).toMatch(/geaccepteerde offerte/);
  });

  it("maakt de factuur via de permissie en nummert door op het bedrijf", () => {
    const first = invoiceXml({}, {}, ["FAC-2026-001"]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.invoice.number).toBe("FAC-2026-002");

    const store = {
      quotes: [quote({ id: "q-engine" })],
      tasks: [],
      settings: settings(),
      permissions: defaultPermissions(),
      approvals: [],
      permissionProposals: [],
      audit: [],
      invoices: [],
      expenses: [],
      appointments: [],
      posts: [],
      leads: [],
    };
    store.permissions.rules = store.permissions.rules.map((rule) =>
      rule.actionType === "factuur_maken"
        ? { ...rule, mode: "automatisch" as const, existingCustomersOnly: false, maxAmountCents: null }
        : rule,
    );
    const result = requestAction(
      store,
      { actor: OWNER, payload: { type: "factuur_maken", quoteId: "q-engine" } },
      NOW,
    );
    expect(result.effect).toBe("uitvoeren");
    expect(result.store.invoices).toHaveLength(1);
    expect(result.store.invoices[0]?.number).toBe("FAC-2026-001");
    expect(result.store.invoices[0]?.ublXml).toContain(CUSTOMIZATION_ID);
    expect(store.invoices).toHaveLength(0);
  });
});

describe("mock Access Point", () => {
  it("verstuurt niets over het netwerk en is de standaard", async () => {
    const created = invoiceXml();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("fetch mag niet");
    };
    try {
      const provider = resolvePeppolProvider({});
      expect(provider.id).toBe("mock");
      const result = await provider.send({
        invoiceNumber: created.invoice.number,
        senderScheme: "0106",
        senderId: "12345678",
        receiverScheme: "0106",
        receiverId: "87654321",
        xml: created.invoice.ublXml ?? "",
      });
      expect(result.ok).toBe(true);
      expect(result.provider).toBe("mock");
      expect(result.transmissionId).toMatch(/^mock-FAC-2026-001-/);
      expect(result.message).toMatch(/niets naar het Peppol-netwerk/);
      const blocked = await resolvePeppolProvider({ GEREGELDWERK_PEPPOL_PROVIDER: "storecove" }).send({
        invoiceNumber: "FAC-2026-009",
        senderScheme: "0106",
        senderId: "12345678",
        receiverScheme: "0106",
        receiverId: "87654321",
        xml: "<Invoice/>",
      });
      expect(blocked.ok).toBe(false);
      expect(blocked.message).toMatch(/niet aangesloten/);
      expect(createMockAccessPoint().id).toBe("mock");
    } finally {
      globalThis.fetch = original;
    }
  });
});
