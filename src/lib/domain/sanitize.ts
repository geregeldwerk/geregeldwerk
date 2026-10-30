import {
  buildJobDescription,
  collectMissingInfo,
  extractRequestedDate,
  groundedLineDescription,
  suggestFollowUp,
  textIncludesFold,
} from "@/lib/domain/extract";
import type { ExtractedLine, Extraction } from "@/lib/domain/types";

/**
 * Keep only fields that appear in the source message and drop every price.
 * A model is not allowed to invent customers, places, dates, or amounts.
 */
export function sanitizeExtraction(raw: unknown, sourceText: string): Extraction {
  const record = isRecord(raw) ? raw : {};
  const customerName = groundName(asString(record.customerName), sourceText);
  const location = groundLocation(asString(record.location), sourceText);
  const customerPhone = groundPhone(asString(record.customerPhone), sourceText);
  const customerEmail = groundEmail(asString(record.customerEmail), sourceText);
  const requestedDate = groundDate(asString(record.requestedDate), sourceText);
  const lineItems = groundLines(record.lineItems, sourceText);
  const jobFromModel = asString(record.jobDescription);
  const jobDescription =
    jobFromModel && groundedLineDescription(jobFromModel, sourceText)
      ? jobFromModel
      : buildJobDescription(lineItems);

  return {
    customerName,
    customerPhone,
    customerEmail,
    location,
    jobDescription,
    requestedDate,
    lineItems,
    missingInfo: collectMissingInfo(sourceText, {
      customerName,
      location,
      customerPhone,
      customerEmail,
      requestedDate,
      lineItems,
    }),
    followUp: suggestFollowUp(sourceText, customerName, requestedDate),
  };
}

function groundLines(value: unknown, source: string): ExtractedLine[] {
  if (!Array.isArray(value)) return [];
  const lines: ExtractedLine[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const description = asString(item.description);
    if (!description || !groundedLineDescription(description, source)) continue;
    lines.push({
      description,
      quantity: asQuantity(item.quantity),
      unit: asString(item.unit),
    });
  }
  return lines;
}

function groundName(name: string | null, source: string): string | null {
  if (!name) return null;
  const tokens = name.split(/\s+/).filter((token) => token.replace(/\./g, "").length >= 3);
  const meaningful = tokens.filter((token) => !/^(dhr|mevr|mevrouw|meneer|familie)$/i.test(token.replace(".", "")));
  if (meaningful.length === 0) return null;
  const ok = meaningful.every((token) => textIncludesFold(source, token.replace(/\.$/, "")));
  return ok ? name : null;
}

function groundLocation(location: string | null, source: string): string | null {
  if (!location) return null;
  const tokens = location.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 4);
  if (tokens.length === 0) return null;
  return tokens.every((token) => textIncludesFold(source, token)) ? location : null;
}

function groundPhone(phone: string | null, source: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const sourceDigits = source.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return sourceDigits.includes(digits) ? phone : null;
}

function groundEmail(email: string | null, source: string): string | null {
  if (!email) return null;
  return textIncludesFold(source, email) ? email : null;
}

function groundDate(date: string | null, source: string): string | null {
  if (!date) return null;
  if (textIncludesFold(source, date)) return date;
  const found = extractRequestedDate(source);
  if (found && found.toLocaleLowerCase("nl-NL") === date.toLocaleLowerCase("nl-NL")) return found;
  return null;
}

function asQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
