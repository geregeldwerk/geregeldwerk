/** Nederlands bedrag zonder spatie na het euroteken: €29,95 of €1.199,50. */
export function formatPriceCents(cents: number, wholeEuros = false): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(euros);
  const body = rest === 0 && wholeEuros ? `€${grouped}` : `€${grouped},${String(rest).padStart(2, "0")}`;
  return negative ? `-${body}` : body;
}

export function formatAddonPrice(addon: { priceCents: number; prefix: string; suffix: string; wholeEuros: boolean }): string {
  return `${addon.prefix}${formatPriceCents(addon.priceCents, addon.wholeEuros)}${addon.suffix}`;
}
