/**
 * Alleen badges met verified: true komen op de site.
 * Zet verified pas op true als de claim voor deze versie waar is.
 * Nog niet waar, en daarom uit: AVG-proof, hosting in de EU, ISO, SSL-keurmerk, veilige betaling.
 */
export interface TrustBadge {
  id: string;
  label: string;
  verified: boolean;
}

export const trustBadges: TrustBadge[] = [
  { id: "peppol", label: "Peppol e-facturatie (UBL) ingebouwd", verified: true },
  { id: "approval", label: "Niets wordt verstuurd zonder jouw goedkeuring", verified: true },
  { id: "market", label: "Nederlandstalig, voor NL en BE", verified: true },
  { id: "pricing", label: "Prijzen excl. btw, helder per maand of jaar", verified: true },
  { id: "avg", label: "AVG-proof", verified: false },
  { id: "eu-hosting", label: "Gehost in de EU", verified: false },
];

export function visibleTrustBadges(badges: TrustBadge[] = trustBadges): TrustBadge[] {
  return badges.filter((badge) => badge.verified);
}

/**
 * Echte reviews, met toestemming van de persoon.
 * Leeg laten tot er een review is. Geen placeholders.
 * score is optioneel en hoort bij die ene review; er is geen gemiddelde.
 */
export interface Review {
  name: string;
  company: string;
  industry: string;
  quote: string;
  score?: number;
  /** Alleen true hoort in de gepubliceerde lijst. */
  consent: boolean;
}

export const reviews: Review[] = [];

export function publishedReviews(items: readonly Review[] = reviews): Review[] {
  return items.filter((review) => review.consent === true && review.name.trim() !== "" && review.quote.trim() !== "");
}
