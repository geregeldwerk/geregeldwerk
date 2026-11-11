import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyQuoteTransition,
  exportCustomerBundle,
  hasExistingCustomerRecord,
  migrateCustomers,
  removeCustomer,
} from "@/lib/domain/customers";
import type { Customer, Invoice, Quote, StoreData } from "@/lib/domain/types";
import { defaultPermissions } from "@/lib/oversight/permissions";
import { createFileRepository } from "@/lib/storage/file-repository";
import { createSeedData, createSeedSettings } from "@/lib/storage/seed";

const NOW = new Date("2026-03-18T09:00:00.000Z");

function emptyStore(): StoreData {
  return {
    quotes: [],
    tasks: [],
    settings: createSeedSettings(),
    permissions: defaultPermissions(),
    approvals: [],
    permissionProposals: [],
    audit: [],
    invoices: [],
    expenses: [],
    appointments: [],
    posts: [],
    leads: [],
    customers: [],
    customerNotes: [],
    customerMigration: { convertedLeadIds: [] },
  };
}

function quote(partial: Partial<Quote> & Pick<Quote, "id" | "customerName" | "status">): Quote {
  return {
    number: "OFF-2026-010",
    example: false,
    customerPhone: "",
    customerEmail: "",
    location: "Hulst",
    jobDescription: "Werk",
    requestedDate: "",
    sourceText: "fictief",
    lines: [],
    notes: "",
    vatRate: 0.21,
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    ...partial,
  };
}

function invoice(partial: Partial<Invoice> & Pick<Invoice, "id" | "customerName">): Invoice {
  return {
    number: "FAC-2026-010",
    quoteId: "ontbreekt",
    amountCents: 1000,
    vatCents: 210,
    totalCents: 1210,
    createdAt: "2026-03-05T09:00:00.000Z",
    example: false,
    simulated: true,
    buyerEndpointId: "NL000000000B00",
    ublXml: "<Invoice>geheim</Invoice>",
    ...partial,
  };
}

describe("migratie en ontdubbeling", () => {
  it("koppelt offertes en facturen op e-mail, houdt leads en is een tweede keer hetzelfde", () => {
    const store = emptyStore();
    store.quotes.push(
      quote({
        id: "q-mail",
        customerName: "Familie Vermeer",
        customerEmail: "Vermeer@example.test",
        status: "geaccepteerd",
      }),
      quote({
        id: "q-zelfde-mail",
        customerName: "Familie Vermeer",
        customerEmail: "vermeer@example.test",
        customerPhone: "0118-000000",
        status: "concept",
        number: "OFF-2026-011",
      }),
    );
    store.invoices.push(invoice({ id: "fac-1", customerName: "Familie Vermeer", quoteId: "q-mail" }));
    store.leads.push({
      id: "lead-1",
      at: "2026-03-20T15:00:00.000Z",
      source: "Instagram",
      name: "Testklant Hulst",
      note: "Fictieve lead.",
      example: true,
    });

    const once = migrateCustomers(store);
    const mailCustomers = once.customers.filter((customer) => customer.email.toLocaleLowerCase("nl-NL") === "vermeer@example.test");
    expect(mailCustomers).toHaveLength(1);
    expect(once.quotes.every((item) => item.customerId === mailCustomers[0]?.id)).toBe(true);
    expect(once.invoices[0]?.customerId).toBe(mailCustomers[0]?.id);
    expect(once.invoices[0]?.paymentStatus).toBe("open");
    expect(mailCustomers[0]?.pipelineStatus).toBe("gewonnen");
    expect(once.leads).toHaveLength(1);
    const leadCustomer = once.customers.find((customer) => customer.sourceLeadId === "lead-1");
    expect(leadCustomer?.pipelineStatus).toBe("lead");
    expect(once.customerNotes.some((note) => note.customerId === leadCustomer?.id && note.text === "Fictieve lead.")).toBe(true);

    const twice = migrateCustomers(once);
    expect(twice.customers.map((customer) => customer.id).sort()).toEqual(once.customers.map((customer) => customer.id).sort());
    expect(twice.customerNotes).toHaveLength(once.customerNotes.length);
    expect(twice.leads).toEqual(once.leads);
  });

  it("ontdubbelt op telefoon en niet op naam alleen", () => {
    const store = emptyStore();
    store.quotes.push(
      quote({ id: "tel-a", customerName: "Piet", customerPhone: "06-12345678", status: "verstuurd" }),
      quote({ id: "tel-b", customerName: "Pieter", customerPhone: "0612345678", status: "concept", number: "OFF-2026-012" }),
      quote({ id: "naam-a", customerName: "Jansen", customerEmail: "jansen-a@example.test", status: "concept", number: "OFF-2026-013" }),
      quote({ id: "naam-b", customerName: "Jansen", customerEmail: "jansen-b@example.test", status: "concept", number: "OFF-2026-014" }),
    );
    const migrated = migrateCustomers(store);
    const phoneIds = migrated.quotes.filter((item) => item.id.startsWith("tel-")).map((item) => item.customerId);
    expect(phoneIds[0]).toBeTruthy();
    expect(phoneIds[0]).toBe(phoneIds[1]);
    const nameIds = migrated.quotes.filter((item) => item.id.startsWith("naam-")).map((item) => item.customerId);
    expect(nameIds[0]).not.toBe(nameIds[1]);
  });

  it("vult de voorbeelddata en laat het leadlogboek staan", () => {
    const once = createSeedData();
    const twice = migrateCustomers(once);
    expect(twice.customers.map((customer) => customer.id).sort()).toEqual(once.customers.map((customer) => customer.id).sort());
    expect(once.leads).toHaveLength(2);
    const wonQuote = once.quotes.find((item) => item.id === "quote-voorbeeld-geaccepteerd");
    const invoice = once.invoices[0];
    expect(wonQuote?.customerId).toBe(invoice?.customerId);
    expect(once.customers.find((customer) => customer.id === wonQuote?.customerId)?.pipelineStatus).toBe("gewonnen");
    const sent = once.quotes.find((item) => item.id === "quote-voorbeeld-verstuurd");
    expect(once.customers.find((customer) => customer.id === sent?.customerId)?.pipelineStatus).toBe("offerte_verstuurd");
    const lost = once.quotes.find((item) => item.id === "quote-voorbeeld-afgewezen");
    const lostCustomer = once.customers.find((customer) => customer.id === lost?.customerId);
    expect(lostCustomer?.pipelineStatus).toBe("verloren");
    expect(lostCustomer?.type).toBe("zakelijk");
    const concept = once.quotes.find((item) => item.id === "quote-voorbeeld-concept");
    const task = once.tasks.find((item) => item.quoteId === concept?.id);
    expect(task?.customerId).toBe(concept?.customerId);
  });
});

describe("pijplijn", () => {
  it("volgt de offerte en laat een handmatige stap staan tot de volgende overgang", () => {
    const store = emptyStore();
    store.settings.lostLeadRetentionDays = 30;
    const customer: Customer = {
      id: "customer-1",
      name: "Testklant Hulst",
      type: "particulier",
      phone: "",
      email: "testklant@example.test",
      address: "Hulst",
      country: "NL",
      vatOrEnterpriseNumber: "",
      source: "Bericht",
      pipelineStatus: "lead",
      lossReason: "",
      tags: [],
      retainUntil: null,
      example: true,
      sourceLeadId: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    store.customers.push(customer);
    const concept = quote({ id: "q1", customerName: customer.name, status: "concept", customerId: customer.id });
    store.quotes.push(concept);

    const sent = { ...concept, status: "verstuurd" as const };
    store.quotes[0] = sent;
    applyQuoteTransition(store, sent, "concept", NOW);
    expect(store.customers[0]?.pipelineStatus).toBe("offerte_verstuurd");

    store.customers[0].pipelineStatus = "verloren";
    applyQuoteTransition(store, sent, "verstuurd", NOW);
    expect(store.customers[0]?.pipelineStatus).toBe("verloren");

    const accepted = { ...sent, status: "geaccepteerd" as const };
    store.quotes[0] = accepted;
    applyQuoteTransition(store, accepted, "verstuurd", NOW);
    expect(store.customers[0]?.pipelineStatus).toBe("gewonnen");
    expect(store.customers[0]?.retainUntil).toBeNull();

    const rejected = { ...accepted, status: "afgewezen" as const };
    store.quotes[0] = rejected;
    applyQuoteTransition(store, rejected, "geaccepteerd", NOW);
    expect(store.customers[0]?.pipelineStatus).toBe("verloren");
    expect(store.customers[0]?.retainUntil).toBe("2026-04-17");

    store.quotes.push(quote({ id: "q2", customerName: customer.name, status: "geaccepteerd", customerId: customer.id, number: "OFF-2026-020" }));
    store.customers[0].pipelineStatus = "gewonnen";
    const otherRejected = quote({ id: "q3", customerName: customer.name, status: "afgewezen", customerId: customer.id, number: "OFF-2026-021" });
    store.quotes.push(otherRejected);
    applyQuoteTransition(store, otherRejected, "verstuurd", NOW);
    expect(store.customers[0]?.pipelineStatus).toBe("gewonnen");
  });
});

describe("verwijderen en exporteren", () => {
  it("bewaart de factuur en de klantgegevens daarop", () => {
    const store = emptyStore();
    store.customers.push({
      id: "customer-1",
      name: "Familie Vermeer",
      type: "particulier",
      phone: "0118-000000",
      email: "vermeer@example.test",
      address: "Middelburg",
      country: "NL",
      vatOrEnterpriseNumber: "",
      source: "Offerte",
      pipelineStatus: "gewonnen",
      lossReason: "",
      tags: ["fictief"],
      retainUntil: null,
      example: true,
      sourceLeadId: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    store.quotes.push(quote({ id: "q1", customerName: "Familie Vermeer", status: "geaccepteerd", customerId: "customer-1", customerEmail: "vermeer@example.test" }));
    store.invoices.push(
      invoice({
        id: "fac-1",
        customerName: "Familie Vermeer",
        quoteId: "q1",
        customerId: "customer-1",
      }),
    );
    store.customerNotes.push({
      id: "note-1",
      customerId: "customer-1",
      text: "Fictieve notitie",
      at: NOW.toISOString(),
      quoteId: null,
      invoiceId: null,
      example: true,
    });

    const removed = removeCustomer(store, "customer-1");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.message).toMatch(/factuur blijft bewaard/);
    expect(removed.message).toMatch(/niet gewist/);
    expect(store.customers).toHaveLength(0);
    expect(store.customerNotes).toHaveLength(0);
    expect(store.invoices[0]?.customerName).toBe("Familie Vermeer");
    expect(store.invoices[0]?.buyerEndpointId).toBe("NL000000000B00");
    expect(store.invoices[0]?.customerId).toBeNull();
    expect(store.invoices[0]?.ublXml).toContain("Invoice");
    expect(store.quotes[0]?.customerId).toBeNull();
    expect(store.quotes[0]?.customerEmail).toBe("vermeer@example.test");

    const again = migrateCustomers(store);
    expect(again.customers).toHaveLength(0);
    expect(again.invoices[0]?.customerName).toBe("Familie Vermeer");
  });

  it("exporteert de klant zonder ubl", () => {
    const store = emptyStore();
    store.customers.push({
      id: "customer-1",
      name: "Firma Voorbeeld BV",
      type: "zakelijk",
      phone: "",
      email: "info@firma-voorbeeld.test",
      address: "Hulst",
      country: "NL",
      vatOrEnterpriseNumber: "NL000000001B00",
      source: "Offerte",
      pipelineStatus: "verloren",
      lossReason: "",
      tags: [],
      retainUntil: null,
      example: true,
      sourceLeadId: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    store.invoices.push(invoice({ id: "fac-1", customerName: "Firma Voorbeeld BV", customerId: "customer-1" }));
    store.customerNotes.push({
      id: "note-1",
      customerId: "customer-1",
      text: "Fictief",
      at: NOW.toISOString(),
      quoteId: null,
      invoiceId: "fac-1",
      example: true,
    });

    const bundle = exportCustomerBundle(store, NOW, "customer-1");
    expect(bundle?.customers[0]?.email).toBe("info@firma-voorbeeld.test");
    expect(bundle?.notes).toHaveLength(1);
    expect(bundle?.invoices[0]).not.toHaveProperty("ublXml");
    expect(bundle?.note).toMatch(/geen privacytekst/i);
    expect(exportCustomerBundle(store, NOW, "ontbreekt")).toBeNull();
  });

  it("kijkt voor bestaande klanten naar het klantrecord", () => {
    const store = emptyStore();
    store.quotes.push(
      quote({ id: "bekend", customerName: "Pieter de Vries", status: "verstuurd" }),
      quote({ id: "nieuw", customerName: "Pieter de Vries", status: "concept" }),
    );
    expect(hasExistingCustomerRecord(store, { email: "", phone: "", exceptQuoteId: "nieuw" })).toBe(false);

    store.customers.push({
      id: "customer-1",
      name: "Pieter de Vries",
      type: "particulier",
      phone: "",
      email: "",
      address: "",
      country: "NL",
      vatOrEnterpriseNumber: "",
      source: "Offerte",
      pipelineStatus: "offerte_verstuurd",
      lossReason: "",
      tags: [],
      retainUntil: null,
      example: true,
      sourceLeadId: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    store.quotes[0].customerId = "customer-1";
    store.quotes[1].customerId = "customer-1";
    expect(hasExistingCustomerRecord(store, { customerId: "customer-1", exceptQuoteId: "nieuw" })).toBe(true);
  });
});

describe("bestandsmigratie", () => {
  it("schrijft ontbrekende klanten terug en houdt de id's stabiel", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "geregeldwerk-crm-"));
    const file = path.join(dir, "store.json");
    const legacy = {
      quotes: [quote({ id: "q-oud", customerName: "Testklant Hulst", customerEmail: "oud@example.test", status: "verstuurd" })],
      settings: createSeedSettings(),
    };
    await writeFile(file, JSON.stringify(legacy));
    const first = await createFileRepository(file).read();
    expect(first.customers).toHaveLength(1);
    expect(first.quotes[0]?.customerId).toBe(first.customers[0]?.id);
    const raw = await readFile(file, "utf8");
    expect(raw).toContain("oud@example.test");
    const second = await createFileRepository(file).read();
    expect(second.customers[0]?.id).toBe(first.customers[0]?.id);
    expect(second.quotes[0]?.customerId).toBe(first.quotes[0]?.customerId);
  });
});
