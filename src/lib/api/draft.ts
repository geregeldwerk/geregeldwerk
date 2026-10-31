import { QuoteInputError, type DraftQuoteInput } from "@/lib/domain/quote";
import type { CompanySettings, Task } from "@/lib/domain/types";

export function parseDraftBody(body: unknown): DraftQuoteInput {
  const record = expectRecord(body);
  return {
    sourceText: stringField(record.sourceText, 8000),
    customerName: stringField(record.customerName, 160),
    customerPhone: stringField(record.customerPhone, 40),
    customerEmail: stringField(record.customerEmail, 160),
    location: stringField(record.location, 200),
    jobDescription: stringField(record.jobDescription, 500),
    requestedDate: stringField(record.requestedDate, 80),
    notes: stringField(record.notes, 2000),
    vatRate: typeof record.vatRate === "number" ? record.vatRate : 0.21,
    lines: Array.isArray(record.lines) ? record.lines.map(parseLine) : [],
  };
}

export function parseFollowUp(body: unknown): { title: string; detail: string } | null {
  const record = expectRecord(body);
  if (record.followUp == null) return null;
  const followUp = expectRecord(record.followUp, "De herinnering is ongeldig.");
  const title = stringField(followUp.title, 160);
  if (!title) throw new QuoteInputError("Een herinnering heeft een titel nodig.");
  return { title, detail: stringField(followUp.detail, 500) };
}

export function parseStatus(body: unknown): string | undefined {
  const record = expectRecord(body);
  if (record.status == null || record.status === "") return undefined;
  if (typeof record.status !== "string") throw new QuoteInputError("Onbekende status");
  return record.status;
}

export function parseSettings(body: unknown): CompanySettings {
  const record = expectRecord(body);
  const validity = numberField(record.quoteValidityDays, 30);
  if (!Number.isInteger(validity) || validity < 1 || validity > 365) {
    throw new QuoteInputError("Geldigheid moet tussen 1 en 365 dagen liggen.");
  }
  return {
    companyName: stringField(record.companyName, 160),
    contactName: stringField(record.contactName, 160),
    address: stringField(record.address, 160),
    postalCode: stringField(record.postalCode, 16),
    city: stringField(record.city, 80),
    kvk: stringField(record.kvk, 20),
    btw: stringField(record.btw, 24),
    iban: stringField(record.iban, 40),
    email: stringField(record.email, 160),
    phone: stringField(record.phone, 40),
    quoteValidityDays: validity,
    defaultVatRate: typeof record.defaultVatRate === "number" ? record.defaultVatRate : 0.21,
    footerNote: stringField(record.footerNote, 400),
  };
}

export function parseTaskBody(body: unknown): Pick<Task, "title" | "detail" | "dueDate" | "quoteId"> {
  const record = expectRecord(body);
  const title = stringField(record.title, 160);
  if (!title) throw new QuoteInputError("Een taak heeft een titel nodig.");
  return {
    title,
    detail: stringField(record.detail, 500),
    dueDate: dateField(record.dueDate),
    quoteId: optionalId(record.quoteId),
  };
}

export function parseTaskPatch(body: unknown): Partial<Pick<Task, "title" | "detail" | "dueDate" | "done">> {
  const record = expectRecord(body);
  const patch: Partial<Pick<Task, "title" | "detail" | "dueDate" | "done">> = {};
  if ("title" in record) {
    const title = stringField(record.title, 160);
    if (!title) throw new QuoteInputError("Een taak heeft een titel nodig.");
    patch.title = title;
  }
  if ("detail" in record) patch.detail = stringField(record.detail, 500);
  if ("dueDate" in record) patch.dueDate = dateField(record.dueDate);
  if ("done" in record) {
    if (typeof record.done !== "boolean") throw new QuoteInputError("Status van de taak is ongeldig.");
    patch.done = record.done;
  }
  return patch;
}

function parseLine(value: unknown) {
  const record = expectRecord(value, "Een offerteregel is ongeldig.");
  const quantity = typeof record.quantity === "number" ? record.quantity : Number(record.quantity);
  let unitPriceCents: number | null = null;
  if (record.unitPriceCents != null && record.unitPriceCents !== "") {
    if (typeof record.unitPriceCents !== "number" || !Number.isInteger(record.unitPriceCents)) {
      throw new QuoteInputError("Prijs moet een geheel getal in centen zijn, of leeg.");
    }
    unitPriceCents = record.unitPriceCents;
  }
  return {
    description: stringField(record.description, 240),
    quantity,
    unit: stringField(record.unit, 20) || "stuk",
    unitPriceCents,
  };
}

function expectRecord(value: unknown, message = "Ongeldige aanvraag."): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new QuoteInputError(message);
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, max: number): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new QuoteInputError("Een tekstveld is ongeldig.");
  return value.trim().slice(0, max);
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function dateField(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new QuoteInputError("Datum moet jjjj-mm-dd zijn, of leeg.");
  }
  return value;
}

function optionalId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new QuoteInputError("Offerteverwijzing is ongeldig.");
  return value.slice(0, 80);
}
