import type { CountryCode, VatScenario } from "@/lib/domain/types";

/**
 * Peppol BIS Billing 3.0.21 (publicatie 2026-05-20, verplicht vanaf 2026-08-17).
 * 3.0.22 staat op het moment van bouwen alleen als november-release in test-docs
 * en is nog niet de geldende specificatie.
 */
export const PEPPOL_BIS_VERSION = "3.0.21";

export const CUSTOMIZATION_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0";

export const PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

export const INVOICE_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
export const CAC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
export const CBC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";

/** Standaardtarieven per land van de verkoper. 0% is nul-tarief (categorie Z), geen vrijstelling. */
export const VAT_PERCENTS: Record<CountryCode, readonly number[]> = {
  NL: [21, 9, 0],
  BE: [21, 12, 6, 0],
};

export const ENDPOINT_SCHEMES = [
  { id: "0106", label: "0106 · KvK (NL)" },
  { id: "0190", label: "0190 · OIN (NL, overheid)" },
  { id: "9944", label: "9944 · btw-nummer (NL)" },
  { id: "0208", label: "0208 · ondernemingsnummer (BE)" },
  { id: "9925", label: "9925 · btw-nummer (BE)" },
] as const;

export const SUPPORTED_ENDPOINT_SCHEMES = ENDPOINT_SCHEMES.map((item) => item.id);

export const SCENARIO_LABEL: Record<VatScenario, string> = {
  standaard: "Standaardtarief",
  verlegd: "Verlegde btw / medecontractant",
  intracommunautair: "Intracommunautaire levering",
};

export const SEND_STATUS_LABEL = {
  niet_verstuurd: "Nog niet verstuurd",
  verstuurd_mock: "Verstuurd via mock",
  mislukt: "Verzenden mislukt",
} as const;

const UNIT_CODES: Record<string, string> = {
  stuk: "C62",
  uur: "HUR",
  meter: "MTR",
  "m²": "MTK",
  m2: "MTK",
  set: "SET",
  post: "C62",
};

export const ALLOWED_UNIT_CODES = ["C62", "HUR", "MTR", "MTK", "SET"] as const;

export function unitCodeFor(unit: string): string | null {
  return UNIT_CODES[unit.trim().toLocaleLowerCase("nl-NL")] ?? null;
}

export function vatPercentsForCountry(country: CountryCode): readonly number[] {
  return VAT_PERCENTS[country];
}

export function percentFromRate(vatRate: number): number {
  return Math.round(vatRate * 100 + 1e-9);
}

export function amsterdamDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function formatQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatPercent(percent: number): string {
  if (Number.isInteger(percent)) return String(percent);
  return String(percent);
}

export function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const negative = trimmed.startsWith("-");
  const [whole, frac = ""] = trimmed.slice(negative ? 1 : 0).split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function vatCentsFromTaxable(taxableCents: number, percent: number): number {
  if (percent === 0) return 0;
  return Math.round((taxableCents * percent) / 100);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
