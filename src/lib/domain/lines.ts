import { centsToInput, parseEuroToCents, parseQuantity } from "@/lib/domain/money";
import type { DraftLineInput } from "@/lib/domain/quote";
import type { ExtractedLine, QuoteLine } from "@/lib/domain/types";

export interface LineDraft {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  price: string;
}

export function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unit: "stuk",
    price: "",
  };
}

export function linesFromExtraction(items: ExtractedLine[]): LineDraft[] {
  if (items.length === 0) return [emptyLine()];
  return items.map((item) => ({
    key: crypto.randomUUID(),
    description: item.description,
    quantity: item.quantity == null ? "1" : formatQuantityInput(item.quantity),
    unit: item.unit ?? "stuk",
    price: "",
  }));
}

export function linesFromQuote(items: QuoteLine[]): LineDraft[] {
  if (items.length === 0) return [emptyLine()];
  return items.map((item) => ({
    key: item.id || crypto.randomUUID(),
    description: item.description,
    quantity: formatQuantityInput(item.quantity),
    unit: item.unit,
    price: centsToInput(item.unitPriceCents),
  }));
}

export function toDraftLines(lines: LineDraft[]): DraftLineInput[] {
  return lines.map((line, index) => {
    const description = line.description.trim();
    if (!description) {
      throw new Error(`Regel ${index + 1} heeft geen omschrijving.`);
    }
    const quantity = parseQuantity(line.quantity);
    if (quantity == null) {
      throw new Error(`Aantal van regel ${index + 1} is ongeldig.`);
    }
    const price = line.price.trim();
    const unitPriceCents = price ? parseEuroToCents(price) : null;
    if (price && unitPriceCents == null) {
      throw new Error(
        `Prijs van regel ${index + 1} is geen geldig bedrag. Gebruik bijvoorbeeld 85,00.`,
      );
    }
    return {
      description,
      quantity,
      unit: line.unit.trim() || "stuk",
      unitPriceCents,
    };
  });
}

function formatQuantityInput(quantity: number): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(quantity);
}
