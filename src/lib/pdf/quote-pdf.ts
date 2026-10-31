import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatEuro } from "@/lib/domain/money";
import { calculateTotals } from "@/lib/domain/money";
import { STATUS_LABEL, type CompanySettings, type Quote } from "@/lib/domain/types";
import { settingsLookPlaceholder } from "@/lib/storage/seed";

export async function renderQuotePdf(quote: Quote, settings: CompanySettings): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.14, 0.13);
  const forest = rgb(0.14, 0.3, 0.23);
  const muted = rgb(0.35, 0.33, 0.3);
  const totals = calculateTotals(quote.lines, quote.vatRate);

  let y = 800;
  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: forest });
  page.drawText(pdfSafe(settings.companyName || "Bedrijf"), {
    x: 48,
    y: 812,
    size: 16,
    font: bold,
    color: rgb(0.96, 0.94, 0.9),
  });
  page.drawText("Geregeldwerk", {
    x: 430,
    y: 814,
    size: 12,
    font: bold,
    color: rgb(0.96, 0.94, 0.9),
  });

  y = 760;
  const title = quote.status === "concept" ? "CONCEPTOFFERTE" : "OFFERTE";
  page.drawText(title, { x: 48, y, size: 18, font: bold, color: forest });
  page.drawText(pdfSafe(`${quote.number}  ·  ${STATUS_LABEL[quote.status]}`), {
    x: 48,
    y: y - 18,
    size: 11,
    font,
    color: muted,
  });

  y = 710;
  const companyLines = [
    settings.contactName,
    settings.address,
    `${settings.postalCode} ${settings.city}`.trim(),
    settings.email,
    settings.phone,
  ].filter(Boolean);
  drawLines(page, font, companyLines.map(pdfSafe), 360, y, 10, muted);

  const customerLines = [
    "Klant",
    quote.customerName || "Naam ontbreekt",
    quote.location || "Plaats ontbreekt",
    quote.customerPhone,
    quote.customerEmail,
    quote.requestedDate ? `Gewenst: ${quote.requestedDate}` : "",
  ].filter(Boolean);
  page.drawText(pdfSafe(customerLines[0]), { x: 48, y, size: 9, font: bold, color: muted });
  drawLines(page, font, customerLines.slice(1).map(pdfSafe), 48, y - 16, 11, ink);

  y = 600;
  if (quote.jobDescription) {
    page.drawText("Werk", { x: 48, y, size: 9, font: bold, color: muted });
    y = drawWrapped(page, font, pdfSafe(quote.jobDescription), 48, y - 16, 500, 11, ink);
    y -= 16;
  }

  page.drawText("Omschrijving", { x: 48, y, size: 9, font: bold, color: muted });
  page.drawText("Aantal", { x: 330, y, size: 9, font: bold, color: muted });
  page.drawText("Prijs", { x: 400, y, size: 9, font: bold, color: muted });
  page.drawText("Totaal", { x: 490, y, size: 9, font: bold, color: muted });
  y -= 8;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.6, color: forest });
  y -= 18;

  for (const line of quote.lines) {
    const lineTotal =
      line.unitPriceCents == null
        ? "—"
        : pdfMoney(Math.round(line.quantity * line.unitPriceCents));
    const price = line.unitPriceCents == null ? "prijs ontbreekt" : pdfMoney(line.unitPriceCents);
    page.drawText(pdfSafe(line.description).slice(0, 52), { x: 48, y, size: 11, font, color: ink });
    page.drawText(pdfSafe(`${formatQuantity(line.quantity)} ${line.unit}`), {
      x: 330,
      y,
      size: 11,
      font,
      color: ink,
    });
    page.drawText(pdfSafe(price), { x: 400, y, size: 10, font, color: ink });
    page.drawText(pdfSafe(lineTotal), { x: 490, y, size: 11, font, color: ink });
    y -= 20;
    if (y < 160) break;
  }

  y -= 8;
  page.drawLine({ start: { x: 330, y: y + 8 }, end: { x: 547, y: y + 8 }, thickness: 0.4, color: muted });
  const summary = [
    `Subtotaal  ${pdfMoney(totals.subtotalCents)}`,
    `BTW ${Math.round(quote.vatRate * 100)}%  ${pdfMoney(totals.vatCents)}`,
    `Totaal  ${pdfMoney(totals.totalCents)}`,
  ];
  for (const row of summary) {
    page.drawText(pdfSafe(row), { x: 360, y, size: 11, font: row.startsWith("Totaal") ? bold : font, color: ink });
    y -= 16;
  }

  if (!totals.complete) {
    y -= 6;
    page.drawText("Prijzen incompleet. Dit document is nog geen verzendklare offerte.", {
      x: 48,
      y,
      size: 10,
      font: bold,
      color: rgb(0.55, 0.32, 0.08),
    });
    y -= 18;
  }

  if (quote.notes) {
    y -= 8;
    page.drawText("Opmerking", { x: 48, y, size: 9, font: bold, color: muted });
    y = drawWrapped(page, font, pdfSafe(quote.notes), 48, y - 14, 500, 10, ink);
  }

  const footer = [
    `Geldig ${settings.quoteValidityDays} dagen. KvK ${settings.kvk} · BTW ${settings.btw} · IBAN ${settings.iban}`,
    settings.footerNote,
    settingsLookPlaceholder(settings)
      ? "Bedrijfsgegevens zijn placeholders. Vul je eigen gegevens in bij Instellingen."
      : "",
  ].filter(Boolean);
  drawLines(page, font, footer.map(pdfSafe), 48, 72, 9, muted);

  return doc.save();
}

function pdfMoney(cents: number): string {
  return formatEuro(cents).replace("€", "EUR").replace(/\u00a0|\u202f/g, " ");
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(quantity);
}

export function pdfSafe(text: string): string {
  const replaced = text
    .replaceAll("€", "EUR ")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("²", "2")
    .replaceAll("ĳ", "ij")
    .replaceAll("Ĳ", "IJ");
  return [...replaced].map((char) => (char.charCodeAt(0) <= 255 ? char : "?")).join("");
}

function drawLines(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  let cursor = y;
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size + 3;
  }
}

function drawWrapped(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: ReturnType<typeof rgb>,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let cursor = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width) {
      page.drawText(line, { x, y: cursor, size, font, color });
      cursor -= size + 3;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= size + 3;
  }
  return cursor;
}
