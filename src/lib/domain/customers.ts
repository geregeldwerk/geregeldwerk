import { QuoteInputError } from "@/lib/domain/quote";
import {
  CUSTOMER_TYPES,
  PAYMENT_STATUSES,
  PIPELINE_STATUSES,
  STATUS_LABEL,
  type CompanySettings,
  type Customer,
  type CustomerType,
  type Invoice,
  type LeadEntry,
  type PaymentStatus,
  type PipelineStatus,
  type Quote,
  type QuoteStatus,
  type StoreData,
} from "@/lib/domain/types";

export interface TimelineEvent {
  id: string;
  at: string;
  kind: "offerte" | "factuur" | "betaling" | "notitie" | "taak" | "afspraak";
  title: string;
  detail: string;
  href: string | null;
}

export interface CustomerDraft {
  name: string;
  type: CustomerType;
  phone: string;
  email: string;
  address: string;
  country: "NL" | "BE";
  vatOrEnterpriseNumber: string;
  source: string;
  pipelineStatus: PipelineStatus;
  lossReason: string;
  tags: string[];
  retainUntil: string | null;
  example: boolean;
  sourceLeadId: string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("nl-NL");
}

export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("nl-NL")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findCustomerByContact(
  customers: readonly Customer[],
  email: string,
  phone: string,
): Customer | undefined {
  const emailKey = normalizeEmail(email);
  const phoneKey = normalizePhone(phone);
  if (emailKey) {
    const byEmail = customers.find((customer) => normalizeEmail(customer.email) === emailKey);
    if (byEmail) return byEmail;
  }
  if (phoneKey) {
    return customers.find((customer) => normalizePhone(customer.phone) === phoneKey);
  }
  return undefined;
}

export function suggestCustomers(
  customers: readonly Customer[],
  query: { name?: string; email?: string; phone?: string },
): Customer[] {
  const email = normalizeEmail(query.email);
  const phone = normalizePhone(query.phone);
  const name = normalizeName(query.name);
  const found = new Map<string, Customer>();
  for (const customer of customers) {
    const emailHit = Boolean(email) && normalizeEmail(customer.email) === email;
    const phoneHit = Boolean(phone) && normalizePhone(customer.phone) === phone;
    const nameHit = Boolean(name) && normalizeName(customer.name) === name;
    if (emailHit || phoneHit || nameHit) found.set(customer.id, customer);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "nl"));
}

export function retainUntilFromSettings(settings: CompanySettings, now: Date): string | null {
  const days = settings.lostLeadRetentionDays;
  if (days == null || !Number.isInteger(days) || days < 1) return null;
  const date = new Date(now.getTime());
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function migrationPending(input: Partial<StoreData> | null | undefined): boolean {
  if (!input) return true;
  if (!Array.isArray(input.customers) || !Array.isArray(input.customerNotes)) return true;
  if (!input.customerMigration || !Array.isArray(input.customerMigration.convertedLeadIds)) return true;
  if ((input.quotes ?? []).some((quote) => needsCustomerLink(quote))) return true;
  if ((input.invoices ?? []).some((invoice) => needsCustomerLink(invoice) || !isPaymentStatus(invoice.paymentStatus))) {
    return true;
  }
  if ((input.tasks ?? []).some((task) => needsCustomerLink(task))) return true;
  if ((input.appointments ?? []).some((item) => needsCustomerLink(item))) return true;
  const converted = new Set(input.customerMigration.convertedLeadIds);
  return (input.leads ?? []).some((lead) => !converted.has(lead.id));
}

/**
 * Maakt klantkaarten uit offertes, facturen en leads.
 * Bestaande rijen blijven staan. Een lege customerId (null) betekent dat de kaart bewust is losgemaakt.
 */
export function migrateCustomers(input: StoreData): StoreData {
  const store = structuredClone(input);
  store.customers = (store.customers ?? []).filter((customer) => customer && typeof customer.id === "string").map(normalizeCustomer);
  store.customerNotes = (store.customerNotes ?? []).filter((note) => note && typeof note.id === "string" && typeof note.customerId === "string");
  if (!store.customerMigration || !Array.isArray(store.customerMigration.convertedLeadIds)) {
    store.customerMigration = { convertedLeadIds: [] };
  }

  const byId = new Map(store.customers.map((customer) => [customer.id, customer]));

  const quotes = [...store.quotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const quote of quotes) {
    if (!needsCustomerLink(quote)) {
      const linked = quote.customerId ? byId.get(quote.customerId) : undefined;
      if (linked) absorbContact(linked, contactFromQuote(quote));
      continue;
    }
    const contact = contactFromQuote(quote);
    const customer = matchOrCreate(
      store,
      byId,
      contact,
      `customer-quote-${quote.id}`,
      pipelineFromQuoteStatus(quote.status),
      new Date(quote.createdAt),
    );
    quote.customerId = customer.id;
  }

  for (const invoice of store.invoices) {
    if (!isPaymentStatus(invoice.paymentStatus)) invoice.paymentStatus = "open";
    if (!needsCustomerLink(invoice)) continue;
    const quote = store.quotes.find((item) => item.id === invoice.quoteId);
    if (quote?.customerId && byId.has(quote.customerId)) {
      invoice.customerId = quote.customerId;
      continue;
    }
    const customer = matchOrCreate(
      store,
      byId,
      {
        name: invoice.customerName,
        email: "",
        phone: "",
        address: "",
        country: invoice.buyerCountry === "BE" ? "BE" : "NL",
        vatOrEnterpriseNumber: "",
        type: "particulier",
        source: "Factuur",
        example: invoice.example,
      },
      `customer-invoice-${invoice.id}`,
      "gewonnen",
      new Date(invoice.createdAt),
    );
    invoice.customerId = customer.id;
  }

  for (const task of store.tasks) {
    if (!needsCustomerLink(task)) continue;
    const quote = task.quoteId ? store.quotes.find((item) => item.id === task.quoteId) : undefined;
    task.customerId = quote?.customerId && byId.has(quote.customerId) ? quote.customerId : null;
  }

  for (const appointment of store.appointments) {
    if (!needsCustomerLink(appointment)) continue;
    const quote = appointment.quoteId ? store.quotes.find((item) => item.id === appointment.quoteId) : undefined;
    appointment.customerId = quote?.customerId && byId.has(quote.customerId) ? quote.customerId : null;
  }

  for (const lead of store.leads) {
    if (store.customerMigration.convertedLeadIds.includes(lead.id)) continue;
    if (store.customers.some((customer) => customer.sourceLeadId === lead.id)) {
      store.customerMigration.convertedLeadIds.push(lead.id);
      continue;
    }
    const customer = createCustomer(
      {
        id: `customer-lead-${lead.id}`,
        name: lead.name,
        type: "particulier",
        phone: "",
        email: "",
        address: "",
        country: "NL",
        vatOrEnterpriseNumber: "",
        source: lead.source,
        pipelineStatus: "lead",
        lossReason: "",
        tags: [],
        retainUntil: null,
        example: lead.example,
        sourceLeadId: lead.id,
      },
      new Date(lead.at),
    );
    store.customers.unshift(customer);
    byId.set(customer.id, customer);
    if (lead.note.trim()) {
      store.customerNotes.unshift({
        id: `note-lead-${lead.id}`,
        customerId: customer.id,
        text: lead.note,
        at: lead.at,
        quoteId: null,
        invoiceId: null,
        example: lead.example,
      });
    }
    store.customerMigration.convertedLeadIds.push(lead.id);
  }

  return store;
}

export function ensureCustomerForLead(store: StoreData, lead: LeadEntry, now: Date): Customer {
  const migrated = migrateCustomers(store);
  copyCrm(store, migrated);
  const existing = store.customers.find((customer) => customer.sourceLeadId === lead.id);
  if (existing) return existing;
  const customer = createCustomer(
    {
      name: lead.name,
      type: "particulier",
      phone: "",
      email: "",
      address: "",
      country: "NL",
      vatOrEnterpriseNumber: "",
      source: lead.source,
      pipelineStatus: "lead",
      lossReason: "",
      tags: [],
      retainUntil: null,
      example: lead.example,
      sourceLeadId: lead.id,
    },
    now,
  );
  store.customers.unshift(customer);
  if (!store.customerMigration.convertedLeadIds.includes(lead.id)) {
    store.customerMigration.convertedLeadIds.push(lead.id);
  }
  if (lead.note.trim()) {
    store.customerNotes.unshift({
      id: `note-${crypto.randomUUID()}`,
      customerId: customer.id,
      text: lead.note,
      at: now.toISOString(),
      quoteId: null,
      invoiceId: null,
      example: lead.example,
    });
  }
  return customer;
}

export function createCustomer(input: CustomerDraft & { id?: string }, now: Date): Customer {
  const createdAt = now.toISOString();
  return {
    id: input.id ?? `customer-${crypto.randomUUID()}`,
    name: input.name.trim(),
    type: input.type,
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    country: input.country === "BE" ? "BE" : "NL",
    vatOrEnterpriseNumber: input.vatOrEnterpriseNumber.trim(),
    source: input.source.trim(),
    pipelineStatus: input.pipelineStatus,
    lossReason: input.lossReason.trim(),
    tags: normalizeTags(input.tags),
    retainUntil: input.retainUntil,
    example: input.example,
    sourceLeadId: input.sourceLeadId,
    createdAt,
    updatedAt: createdAt,
  };
}

export function parseCustomerBody(body: unknown, settings: CompanySettings, now: Date): CustomerDraft {
  const record = expectRecord(body);
  const name = stringField(record.name, 160);
  if (!name) throw new QuoteInputError("Een klant heeft een naam nodig.");
  const pipelineStatus = pipelineField(record.pipelineStatus);
  const requestedRetention = retainField(record.retainUntil);
  const retainUntil =
    pipelineStatus === "verloren" && requestedRetention == null
      ? retainUntilFromSettings(settings, now)
      : requestedRetention;
  return {
    name,
    type: typeField(record.type),
    phone: stringField(record.phone, 40),
    email: emailField(record.email),
    address: stringField(record.address, 200),
    country: record.country === "BE" ? "BE" : "NL",
    vatOrEnterpriseNumber: stringField(record.vatOrEnterpriseNumber, 32),
    source: stringField(record.source, 80),
    pipelineStatus,
    lossReason: stringField(record.lossReason, 500),
    tags: tagsField(record.tags),
    retainUntil,
    example: false,
    sourceLeadId: null,
  };
}

export function attachCustomerChoice(
  store: StoreData,
  quote: Quote,
  choice: { customerId: string | null },
  now: Date,
): { customerId: string; deduped: boolean } {
  if (choice.customerId) {
    const chosen = store.customers.find((customer) => customer.id === choice.customerId);
    if (!chosen) throw new QuoteInputError("De gekozen klant bestaat niet.");
    return { customerId: chosen.id, deduped: false };
  }
  const existing = findCustomerByContact(store.customers, quote.customerEmail, quote.customerPhone);
  if (existing) return { customerId: existing.id, deduped: true };
  const customer = createCustomer(
    {
      name: quote.customerName.trim() || "Naam ontbreekt",
      type: quote.customerVat?.trim() || quote.customerLegalId?.trim() ? "zakelijk" : "particulier",
      phone: quote.customerPhone,
      email: quote.customerEmail,
      address: quote.location,
      country: quote.customerCountry === "BE" ? "BE" : "NL",
      vatOrEnterpriseNumber: quote.customerVat?.trim() || quote.customerLegalId?.trim() || "",
      source: "Bericht",
      pipelineStatus: "lead",
      lossReason: "",
      tags: [],
      retainUntil: null,
      example: quote.example,
      sourceLeadId: null,
    },
    now,
  );
  store.customers.unshift(customer);
  return { customerId: customer.id, deduped: false };
}

/**
 * Een klantrecord telt als bestaand voor de permissie als er al werk is
 * (verstuurde offerte, factuur of een stap voorbij lead). Een losse lead niet.
 */
export function hasExistingCustomerRecord(
  store: StoreData,
  input: { customerId?: string | null; email?: string; phone?: string; exceptQuoteId?: string },
): boolean {
  const linked = input.customerId ? store.customers.find((customer) => customer.id === input.customerId) : undefined;
  const customer = linked ?? findCustomerByContact(store.customers, input.email ?? "", input.phone ?? "");
  if (!customer) return false;
  const priorQuote = store.quotes.some(
    (quote) => quote.customerId === customer.id && quote.id !== input.exceptQuoteId && quote.status !== "concept",
  );
  if (priorQuote) return true;
  if (store.invoices.some((invoice) => invoice.customerId === customer.id)) return true;
  return customer.pipelineStatus !== "lead";
}

export function applyQuoteTransition(store: StoreData, quote: Quote, previousStatus: QuoteStatus, now: Date): void {
  if (quote.status === previousStatus || !quote.customerId) return;
  const customer = store.customers.find((item) => item.id === quote.customerId);
  if (!customer) return;

  if (quote.status === "geaccepteerd") {
    customer.pipelineStatus = "gewonnen";
    customer.retainUntil = null;
  } else if (quote.status === "verstuurd") {
    if (customer.pipelineStatus !== "gewonnen") {
      customer.pipelineStatus = "offerte_verstuurd";
      customer.retainUntil = null;
    }
  } else if (quote.status === "afgewezen") {
    const others = store.quotes.filter((item) => item.customerId === customer.id && item.id !== quote.id);
    if (others.some((item) => item.status === "geaccepteerd")) {
      customer.pipelineStatus = "gewonnen";
    } else if (others.some((item) => item.status === "verstuurd")) {
      customer.pipelineStatus = "offerte_verstuurd";
      customer.retainUntil = null;
    } else {
      customer.pipelineStatus = "verloren";
      customer.retainUntil = customer.retainUntil ?? retainUntilFromSettings(store.settings, now);
    }
  } else {
    return;
  }
  customer.updatedAt = now.toISOString();
}

export function removeCustomer(store: StoreData, customerId: string): { ok: true; message: string } | { ok: false; error: string } {
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) return { ok: false, error: "Deze klant bestaat niet." };
  const invoices = store.invoices.filter((invoice) => invoice.customerId === customerId);
  for (const invoice of invoices) invoice.customerId = null;
  for (const quote of store.quotes) {
    if (quote.customerId === customerId) quote.customerId = null;
  }
  for (const task of store.tasks) {
    if (task.customerId === customerId) task.customerId = null;
  }
  for (const appointment of store.appointments) {
    if (appointment.customerId === customerId) appointment.customerId = null;
  }
  store.customers = store.customers.filter((item) => item.id !== customerId);
  store.customerNotes = store.customerNotes.filter((note) => note.customerId !== customerId);
  const message =
    invoices.length === 0
      ? "De klantkaart is verwijderd. Er stonden geen facturen op deze klant."
      : invoices.length === 1
        ? "De klantkaart is verwijderd. 1 factuur blijft bewaard. De klantgegevens op die factuur zijn niet gewist."
        : `De klantkaart is verwijderd. ${invoices.length} facturen blijven bewaard. De klantgegevens op die facturen zijn niet gewist.`;
  return { ok: true, message };
}

export function exportCustomerBundle(store: StoreData, now = new Date(), customerId?: string) {
  const customers = customerId ? store.customers.filter((customer) => customer.id === customerId) : store.customers;
  if (customerId && customers.length === 0) return null;
  const ids = new Set(customers.map((customer) => customer.id));
  const linked = <T extends { customerId?: string | null }>(items: T[]) => items.filter((item) => item.customerId && ids.has(item.customerId));
  return {
    exportedAt: now.toISOString(),
    note: "Lokale export van klantdata uit deze prototype. De UBL van facturen zit er niet bij. Er staat geen privacytekst in: die stel je als eigenaar vast vóór livegang.",
    customers,
    notes: store.customerNotes.filter((note) => ids.has(note.customerId)),
    quotes: linked(store.quotes),
    invoices: linked(store.invoices).map(withoutUbl),
    tasks: linked(store.tasks),
    appointments: linked(store.appointments),
  };
}

export function buildTimeline(store: StoreData, customerId: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const quote of store.quotes) {
    if (quote.customerId !== customerId) continue;
    events.push({
      id: `timeline-quote-${quote.id}`,
      at: quote.updatedAt || quote.createdAt,
      kind: "offerte",
      title: `Offerte ${quote.number}`,
      detail: `${STATUS_LABEL[quote.status]} · ${quote.jobDescription || "Geen omschrijving"}`,
      href: `/offertes/${quote.id}`,
    });
  }
  for (const invoice of store.invoices) {
    if (invoice.customerId !== customerId) continue;
    events.push({
      id: `timeline-invoice-${invoice.id}`,
      at: invoice.createdAt,
      kind: "factuur",
      title: `Factuur ${invoice.number}`,
      detail: invoice.customerName,
      href: `/facturen/${invoice.id}`,
    });
    const payment = invoice.paymentStatus ?? "open";
    events.push({
      id: `timeline-payment-${invoice.id}`,
      at: invoice.paymentUpdatedAt || invoice.createdAt,
      kind: "betaling",
      title: `Betaling ${invoice.number}`,
      detail: paymentLabel(payment),
      href: `/facturen/${invoice.id}`,
    });
  }
  for (const note of store.customerNotes) {
    if (note.customerId !== customerId) continue;
    events.push({
      id: `timeline-note-${note.id}`,
      at: note.at,
      kind: "notitie",
      title: "Notitie",
      detail: note.text,
      href: null,
    });
  }
  for (const task of store.tasks) {
    if (task.customerId !== customerId) continue;
    events.push({
      id: `timeline-task-${task.id}`,
      at: task.createdAt,
      kind: "taak",
      title: task.done ? `Taak afgerond: ${task.title}` : `Taak: ${task.title}`,
      detail: task.detail,
      href: "/taken",
    });
  }
  for (const appointment of store.appointments) {
    if (appointment.customerId !== customerId) continue;
    events.push({
      id: `timeline-appointment-${appointment.id}`,
      at: appointment.createdAt,
      kind: "afspraak",
      title: appointment.title,
      detail: appointment.when,
      href: null,
    });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title, "nl"));
}

export function applyLostLeadRetention(store: StoreData, now: Date): void {
  const until = retainUntilFromSettings(store.settings, now);
  if (!until) return;
  for (const customer of store.customers) {
    if (customer.pipelineStatus === "verloren" && !customer.retainUntil) {
      customer.retainUntil = until;
      customer.updatedAt = now.toISOString();
    }
  }
}

function paymentLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    open: "Open",
    betaald: "Betaald",
    herinnering: "Herinnering",
    oninbaar: "Oninbaar",
  };
  return labels[status];
}

function withoutUbl(invoice: Invoice): Omit<Invoice, "ublXml"> {
  const copy = { ...invoice };
  delete copy.ublXml;
  return copy;
}

function copyCrm(target: StoreData, source: StoreData) {
  target.customers = source.customers;
  target.customerNotes = source.customerNotes;
  target.customerMigration = source.customerMigration;
  target.quotes = source.quotes;
  target.invoices = source.invoices;
  target.tasks = source.tasks;
  target.appointments = source.appointments;
}

interface ContactSeed {
  name: string;
  email: string;
  phone: string;
  address: string;
  country: "NL" | "BE";
  vatOrEnterpriseNumber: string;
  type: CustomerType;
  source: string;
  example: boolean;
}

function contactFromQuote(quote: Quote): ContactSeed {
  const street = [quote.customerStreet, quote.customerPostalCode, quote.customerCity].filter((part) => part?.trim()).join(", ");
  const vat = quote.customerVat?.trim() || quote.customerLegalId?.trim() || "";
  return {
    name: quote.customerName,
    email: quote.customerEmail,
    phone: quote.customerPhone,
    address: street || quote.location,
    country: quote.customerCountry === "BE" ? "BE" : "NL",
    vatOrEnterpriseNumber: vat,
    type: vat ? "zakelijk" : "particulier",
    source: "Offerte",
    example: quote.example,
  };
}

function matchOrCreate(
  store: StoreData,
  byId: Map<string, Customer>,
  contact: ContactSeed,
  fallbackId: string,
  pipeline: PipelineStatus,
  at: Date,
): Customer {
  const found = findCustomerByContact(store.customers, contact.email, contact.phone);
  if (found) {
    absorbContact(found, contact);
    found.pipelineStatus = mergePipeline(found.pipelineStatus, pipeline);
    if (contact.type === "zakelijk") found.type = "zakelijk";
    found.example = found.example && contact.example;
    return found;
  }
  const email = normalizeEmail(contact.email);
  const phone = normalizePhone(contact.phone);
  const id = email ? `customer-email-${slug(email)}` : phone ? `customer-phone-${slug(phone)}` : fallbackId;
  const existingId = byId.get(id);
  if (existingId) {
    absorbContact(existingId, contact);
    existingId.pipelineStatus = mergePipeline(existingId.pipelineStatus, pipeline);
    return existingId;
  }
  const customer = createCustomer(
    {
      id,
      name: contact.name,
      type: contact.type,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      country: contact.country,
      vatOrEnterpriseNumber: contact.vatOrEnterpriseNumber,
      source: contact.source,
      pipelineStatus: pipeline,
      lossReason: "",
      tags: [],
      retainUntil: null,
      example: contact.example,
      sourceLeadId: null,
    },
    at,
  );
  store.customers.push(customer);
  byId.set(customer.id, customer);
  return customer;
}

function absorbContact(customer: Customer, contact: ContactSeed) {
  if (!customer.email.trim() && contact.email.trim()) customer.email = contact.email.trim();
  if (!customer.phone.trim() && contact.phone.trim()) customer.phone = contact.phone.trim();
  if (!customer.address.trim() && contact.address.trim()) customer.address = contact.address.trim();
  if (!customer.vatOrEnterpriseNumber.trim() && contact.vatOrEnterpriseNumber.trim()) {
    customer.vatOrEnterpriseNumber = contact.vatOrEnterpriseNumber.trim();
  }
  if (!customer.name.trim() && contact.name.trim()) customer.name = contact.name.trim();
}

function mergePipeline(current: PipelineStatus, incoming: PipelineStatus): PipelineStatus {
  if (current === "gewonnen" || incoming === "gewonnen") return "gewonnen";
  if (current === "offerte_verstuurd" || incoming === "offerte_verstuurd") return "offerte_verstuurd";
  if (current === "verloren" || incoming === "verloren") return "verloren";
  return "lead";
}

function pipelineFromQuoteStatus(status: QuoteStatus): PipelineStatus {
  if (status === "geaccepteerd") return "gewonnen";
  if (status === "verstuurd") return "offerte_verstuurd";
  if (status === "afgewezen") return "verloren";
  return "lead";
}

function needsCustomerLink(record: { customerId?: string | null }): boolean {
  return !("customerId" in record) || record.customerId === undefined || record.customerId === "";
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

function normalizeCustomer(customer: Customer): Customer {
  const pipeline = (PIPELINE_STATUSES as readonly string[]).includes(customer.pipelineStatus) ? customer.pipelineStatus : "lead";
  return {
    ...customer,
    name: customer.name ?? "",
    type: customer.type === "zakelijk" ? "zakelijk" : "particulier",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    country: customer.country === "BE" ? "BE" : "NL",
    vatOrEnterpriseNumber: customer.vatOrEnterpriseNumber ?? "",
    source: customer.source ?? "",
    pipelineStatus: pipeline,
    lossReason: customer.lossReason ?? "",
    tags: Array.isArray(customer.tags) ? customer.tags.filter((tag) => typeof tag === "string") : [],
    retainUntil: typeof customer.retainUntil === "string" ? customer.retainUntil : null,
    example: Boolean(customer.example),
    sourceLeadId: typeof customer.sourceLeadId === "string" ? customer.sourceLeadId : null,
    createdAt: customer.createdAt ?? new Date(0).toISOString(),
    updatedAt: customer.updatedAt ?? customer.createdAt ?? new Date(0).toISOString(),
  };
}

function slug(value: string): string {
  return value
    .toLocaleLowerCase("nl-NL")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeTags(tags: string[]): string[] {
  const unique = new Set<string>();
  for (const tag of tags) {
    const clean = tag.trim().slice(0, 40);
    if (clean) unique.add(clean);
  }
  return [...unique].slice(0, 20);
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new QuoteInputError("Ongeldige aanvraag.");
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, max: number): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new QuoteInputError("Een tekstveld is ongeldig.");
  return value.trim().slice(0, max);
}

function emailField(value: unknown): string {
  const email = stringField(value, 160);
  if (email && !email.includes("@")) throw new QuoteInputError("E-mailadres is ongeldig.");
  return email;
}

function typeField(value: unknown): CustomerType {
  if (value == null || value === "") return "particulier";
  if ((CUSTOMER_TYPES as readonly string[]).includes(String(value))) return value as CustomerType;
  throw new QuoteInputError("Kies particulier of zakelijk.");
}

function pipelineField(value: unknown): PipelineStatus {
  if (value == null || value === "") return "lead";
  if ((PIPELINE_STATUSES as readonly string[]).includes(String(value))) return value as PipelineStatus;
  throw new QuoteInputError("Onbekende pijplijnstap.");
}

function retainField(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new QuoteInputError("Bewaar tot moet een datum zijn (jjjj-mm-dd), of leeg.");
  }
  return value;
}

function tagsField(value: unknown): string[] {
  if (value == null || value === "") return [];
  if (typeof value === "string") return normalizeTags(value.split(","));
  if (!Array.isArray(value)) throw new QuoteInputError("Labels zijn ongeldig.");
  return normalizeTags(value.map((tag) => (typeof tag === "string" ? tag : "")));
}

export function customerQuoteSeed(customer: Customer, settings: CompanySettings) {
  return {
    sourceText: "",
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    location: customer.address,
    jobDescription: "",
    requestedDate: "",
    notes: "",
    vatRate: settings.defaultVatRate,
    lines: [] as { description: string; quantity: number; unit: string; unitPriceCents: number | null }[],
    customerCountry: customer.country,
    customerVat: customer.vatOrEnterpriseNumber,
    customerId: customer.id,
    example: customer.example,
  };
}
