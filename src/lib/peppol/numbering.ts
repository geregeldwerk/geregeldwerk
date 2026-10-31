const PATTERN = /^FAC-(\d{4})-(\d+)$/;

/**
 * Volgend factuurnummer binnen één bedrijf.
 * De reeks FAC-jaar-volgnummer loopt door vanaf het hoogste nummer van dat jaar.
 * Een gat wordt niet hergebruikt. Nummers die al bestaan, ook buiten het jaar, worden overgeslagen.
 */
export function nextInvoiceNumber(existing: readonly string[], now = new Date()): string {
  const year = now.getFullYear();
  const taken = new Set(existing);
  let max = 0;
  for (const number of existing) {
    const match = PATTERN.exec(number);
    if (!match || Number(match[1]) !== year) continue;
    max = Math.max(max, Number(match[2]));
  }
  let seq = max + 1;
  let candidate = formatInvoiceNumber(year, seq);
  while (taken.has(candidate)) {
    seq += 1;
    candidate = formatInvoiceNumber(year, seq);
  }
  return candidate;
}

export function formatInvoiceNumber(year: number, seq: number): string {
  return `FAC-${year}-${String(seq).padStart(3, "0")}`;
}
