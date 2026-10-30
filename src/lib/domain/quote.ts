import { calculateTotals } from "@/lib/domain/money";
import {
  QUOTE_STATUSES,
  type Extraction,
  type Quote,
  type QuoteLine,
  type QuoteReview,
  type QuoteStatus,
} from "@/lib/domain/types";

export class QuoteInputError extends Error {
  issues: string[];

  constructor(message: string, issues: string[] = [message]) {
    super(message);
    this.name = "QuoteInputError";
    this.issues = issues;
  }
}

export interface DraftLineInput {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number | null;
}

export interface DraftQuoteInput {
  id?: string;
  sourceText: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  location: string;
  jobDescription: string;
  requestedDate: string;
  notes: string;
  vatRate: number;
  lines: DraftLineInput[];
  example?: boolean;
}

export function assertQuoteStatus(value: string): QuoteStatus {
  if ((QUOTE_STATUSES as readonly string[]).includes(value)) {
    return value as QuoteStatus;
  }
  throw new QuoteInputError("Onbekende status");
}

export function nextQuoteNumber(existing: readonly string[], now = new Date()): string {
  const year = now.getFullYear();
  const pattern = new RegExp(`^OFF-${year}-(\\d+)$`);
  let max = 0;
  for (const number of existing) {
    const match = number.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `OFF-${year}-${String(max + 1).padStart(3, "0")}`;
}

export function reviewQuote(quote: Quote): QuoteReview {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!quote.customerName.trim()) blockers.push("Klantnaam ontbreekt");
  if (!quote.location.trim()) warnings.push("Plaats of adres ontbreekt");
  if (!quote.customerPhone.trim() && !quote.customerEmail.trim()) {
    warnings.push("Contactgegevens ontbreken");
  }
  if (!quote.requestedDate.trim()) warnings.push("Gewenste uitvoerdatum ontbreekt");
  if (quote.lines.length === 0) blockers.push("Geen offerteregels");
  if (quote.lines.some((line) => !line.description.trim())) {
    blockers.push("Een regel heeft geen omschrijving");
  }
  if (quote.lines.some((line) => !(line.quantity > 0))) {
    blockers.push("Aantal moet groter zijn dan 0");
  }

  const totals = calculateTotals(quote.lines, quote.vatRate);
  if (totals.missingPriceCount > 0) {
    blockers.push(
      totals.missingPriceCount === 1
        ? "1 regel heeft nog geen prijs"
        : `${totals.missingPriceCount} regels hebben nog geen prijs`,
    );
  }

  return { blockers, warnings };
}

export function canMarkReady(quote: Quote): boolean {
  return reviewQuote(quote).blockers.length === 0;
}

/** Build a concept quote. Every line price stays empty, even if the message mentioned money. */
export function buildDraftQuote(
  extraction: Extraction,
  options: {
    sourceText: string;
    vatRate: number;
    existingNumbers: readonly string[];
    now?: Date;
    id?: string;
  },
): Quote {
  const now = options.now ?? new Date();
  const lines: QuoteLine[] = extraction.lineItems.map((line, index) => ({
    id: `line-${index + 1}`,
    description: line.description,
    quantity: line.quantity ?? 1,
    unit: line.unit ?? "stuk",
    unitPriceCents: null,
  }));

  return {
    id: options.id ?? "draft",
    number: nextQuoteNumber(options.existingNumbers, now),
    status: "concept",
    example: false,
    customerName: extraction.customerName ?? "",
    customerPhone: extraction.customerPhone ?? "",
    customerEmail: extraction.customerEmail ?? "",
    location: extraction.location ?? "",
    jobDescription: extraction.jobDescription,
    requestedDate: extraction.requestedDate ?? "",
    sourceText: options.sourceText,
    lines,
    notes: "",
    vatRate: options.vatRate,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function createQuote(input: DraftQuoteInput, existingNumbers: readonly string[], now = new Date()): Quote {
  const vatRate = normalizeVat(input.vatRate);
  const lines = input.lines.map((line, index) => normalizeLine(line, index));
  return {
    id: input.id ?? crypto.randomUUID(),
    number: nextQuoteNumber(existingNumbers, now),
    status: "concept",
    example: input.example ?? false,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    customerEmail: input.customerEmail.trim(),
    location: input.location.trim(),
    jobDescription: input.jobDescription.trim(),
    requestedDate: input.requestedDate.trim(),
    sourceText: input.sourceText,
    lines,
    notes: input.notes.trim(),
    vatRate,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function updateQuote(
  existing: Quote,
  patch: Partial<DraftQuoteInput> & { status?: string },
  now = new Date(),
): Quote {
  const next: Quote = {
    ...existing,
    customerName: patch.customerName?.trim() ?? existing.customerName,
    customerPhone: patch.customerPhone?.trim() ?? existing.customerPhone,
    customerEmail: patch.customerEmail?.trim() ?? existing.customerEmail,
    location: patch.location?.trim() ?? existing.location,
    jobDescription: patch.jobDescription?.trim() ?? existing.jobDescription,
    requestedDate: patch.requestedDate?.trim() ?? existing.requestedDate,
    notes: patch.notes?.trim() ?? existing.notes,
    vatRate: patch.vatRate == null ? existing.vatRate : normalizeVat(patch.vatRate),
    lines: patch.lines ? patch.lines.map((line, index) => normalizeLine(line, index)) : existing.lines,
    updatedAt: now.toISOString(),
  };

  if (patch.status != null) {
    const status = assertQuoteStatus(patch.status);
    if (status !== "concept") {
      const review = reviewQuote({ ...next, status });
      if (review.blockers.length > 0) {
        throw new QuoteInputError(
          "Deze offerte is nog niet klaar om te versturen of te accepteren.",
          review.blockers,
        );
      }
    }
    next.status = status;
  }

  return next;
}

function normalizeVat(vatRate: number): number {
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
    throw new QuoteInputError("BTW-tarief is ongeldig");
  }
  return vatRate;
}

function normalizeLine(line: DraftLineInput, index: number): QuoteLine {
  const description = line.description.trim();
  if (!description) throw new QuoteInputError("Een regel heeft geen omschrijving");
  if (!(line.quantity > 0) || !Number.isFinite(line.quantity)) {
    throw new QuoteInputError("Aantal moet groter zijn dan 0");
  }
  if (line.unitPriceCents != null) {
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
      throw new QuoteInputError("Prijs moet een bedrag in centen zijn, of leeg");
    }
  }
  return {
    id: `line-${index + 1}`,
    description,
    quantity: line.quantity,
    unit: line.unit.trim() || "stuk",
    unitPriceCents: line.unitPriceCents,
  };
}
