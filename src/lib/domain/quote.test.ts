import { describe, expect, it } from "vitest";
import { calculateTotals, parseEuroToCents } from "@/lib/domain/money";
import {
  assertQuoteStatus,
  buildDraftQuote,
  canMarkReady,
  nextQuoteNumber,
  reviewQuote,
  updateQuote,
  QuoteInputError,
} from "@/lib/domain/quote";
import { extractFromMessage } from "@/lib/domain/extract";
import type { Quote, QuoteLine } from "@/lib/domain/types";

const NOW = new Date("2026-04-02T12:00:00.000Z");

function line(partial: Partial<QuoteLine> & Pick<QuoteLine, "description">): QuoteLine {
  return {
    id: partial.id ?? "line-1",
    description: partial.description,
    quantity: partial.quantity ?? 1,
    unit: partial.unit ?? "stuk",
    unitPriceCents: partial.unitPriceCents === undefined ? 1000 : partial.unitPriceCents,
  };
}

function quote(partial: Partial<Quote> = {}): Quote {
  return {
    id: "q1",
    number: "OFF-2026-004",
    status: "concept",
    example: false,
    customerName: "Jansen",
    customerPhone: "",
    customerEmail: "",
    location: "Hulst",
    jobDescription: "Kraan vervangen",
    requestedDate: "",
    sourceText: "test",
    lines: [line({ description: "Kraan vervangen", unitPriceCents: null })],
    notes: "",
    vatRate: 0.21,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...partial,
  };
}

describe("prijzen en totalen", () => {
  it("laat regels zonder prijs buiten de som en telt ze als ontbrekend", () => {
    const totals = calculateTotals(
      [
        line({ description: "Kraan", quantity: 2, unitPriceCents: 4500 }),
        line({ description: "Voorrijkosten", unitPriceCents: null }),
      ],
      0.21,
    );

    expect(totals.subtotalCents).toBe(9000);
    expect(totals.vatCents).toBe(1890);
    expect(totals.totalCents).toBe(10890);
    expect(totals.missingPriceCount).toBe(1);
    expect(totals.complete).toBe(false);
  });

  it("rondt 21 procent btw af op centen", () => {
    const totals = calculateTotals([line({ description: "Materiaal", unitPriceCents: 1001 })], 0.21);
    expect(totals.vatCents).toBe(210);
    expect(totals.totalCents).toBe(1211);
  });

  it("rekent een gebroken aantal", () => {
    const totals = calculateTotals(
      [line({ description: "Arbeid", quantity: 2.5, unit: "uur", unitPriceCents: 4500 })],
      0.21,
    );
    expect(totals.subtotalCents).toBe(11250);
  });

  it("leest Nederlandse bedragen", () => {
    expect(parseEuroToCents("12,50")).toBe(1250);
    expect(parseEuroToCents("1.234,56")).toBe(123456);
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("€ 80")).toBe(8000);
    expect(parseEuroToCents("12.50")).toBe(1250);
    expect(parseEuroToCents("abc")).toBeNull();
    expect(parseEuroToCents("-5")).toBeNull();
  });
});

describe("offertestatus", () => {
  it("blokkeert versturen zolang een prijs ontbreekt", () => {
    const draft = quote();
    const review = reviewQuote(draft);
    expect(review.blockers).toContain("1 regel heeft nog geen prijs");
    expect(canMarkReady(draft)).toBe(false);
    expect(() => updateQuote(draft, { status: "verstuurd" }, NOW)).toThrow(QuoteInputError);
  });

  it("laat een complete offerte door naar verstuurd", () => {
    const ready = quote({
      lines: [line({ description: "Kraan vervangen", unitPriceCents: 8000 })],
    });
    expect(canMarkReady(ready)).toBe(true);
    const next = updateQuote(ready, { status: "verstuurd" }, NOW);
    expect(next.status).toBe("verstuurd");
  });

  it("weigert een onbekende status", () => {
    expect(() => assertQuoteStatus("betaald")).toThrow(QuoteInputError);
  });

  it("nummert door binnen het jaar", () => {
    expect(nextQuoteNumber(["OFF-2026-001", "OFF-2026-003", "OFF-2025-009"], NOW)).toBe(
      "OFF-2026-004",
    );
  });

  it("zet geen prijs op een concept uit de extractor", () => {
    const extraction = extractFromMessage(
      "Klant Jansen in Hulst wil een nieuwe cv-ketel, ophangen en oude afvoeren, graag offerte",
    );
    const draft = buildDraftQuote(extraction, {
      sourceText: "bron",
      vatRate: 0.21,
      existingNumbers: ["OFF-2026-003"],
      now: NOW,
      id: "nieuw",
    });
    expect(draft.number).toBe("OFF-2026-004");
    expect(draft.status).toBe("concept");
    expect(draft.lines.length).toBe(3);
    expect(draft.lines.every((item) => item.unitPriceCents === null)).toBe(true);
    expect(canMarkReady(draft)).toBe(false);
  });
});
