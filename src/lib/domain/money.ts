import type { QuoteLine, Totals } from "@/lib/domain/types";

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function centsToInput(cents: number | null): string {
  if (cents == null) return "";
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Accepts Dutch amounts such as "12,50", "1.234,56" and "€ 80".
 * Returns null for empty or unreadable input. Never guesses a price.
 */
export function parseEuroToCents(input: string): number | null {
  const trimmed = input.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!trimmed) return null;

  let normalized = trimmed;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function parseQuantity(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents);
}

export function calculateTotals(lines: QuoteLine[], vatRate: number): Totals {
  let subtotalCents = 0;
  let pricedLineCount = 0;
  let missingPriceCount = 0;

  for (const line of lines) {
    if (line.unitPriceCents == null) {
      missingPriceCount += 1;
      continue;
    }
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    subtotalCents += lineTotalCents(quantity, line.unitPriceCents);
    pricedLineCount += 1;
  }

  const vatCents = Math.round(subtotalCents * vatRate);
  return {
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
    pricedLineCount,
    missingPriceCount,
    complete: lines.length > 0 && missingPriceCount === 0,
  };
}
