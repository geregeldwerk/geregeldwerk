export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function compactVat(value: string): string {
  return value.replace(/[\s.]/g, "").toUpperCase();
}

export function isDutchKvk(value: string): boolean {
  return /^\d{8}$/.test(digitsOnly(value)) && digitsOnly(value).length === value.replace(/\s/g, "").length;
}

export function isDutchKvkCompact(value: string): boolean {
  return /^\d{8}$/.test(value);
}

/** Belgisch ondernemingsnummer: 10 cijfers, controle = 97 − (eerste 8 mod 97). */
export function isBelgianEnterpriseNumber(value: string): boolean {
  const digits = digitsOnly(value);
  if (!/^\d{10}$/.test(digits)) return false;
  const base = Number(digits.slice(0, 8));
  const check = Number(digits.slice(8));
  return check === 97 - (base % 97);
}

export function isDutchVat(value: string): boolean {
  return /^NL\d{9}B\d{2}$/.test(compactVat(value));
}

export function isBelgianVat(value: string): boolean {
  const compact = compactVat(value);
  if (!/^BE\d{10}$/.test(compact)) return false;
  return isBelgianEnterpriseNumber(compact.slice(2));
}

export function normalizeIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban) || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let expanded = "";
  for (const char of rearranged) {
    expanded += char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
  }
  let remainder = 0;
  for (const digit of expanded) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
