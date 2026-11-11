import { describe, expect, it } from "vitest";
import { publishedReviews, visibleTrustBadges, type Review, type TrustBadge } from "@/lib/trust";

describe("trust", () => {
  it("toont alleen geverifieerde badges", () => {
    const badges: TrustBadge[] = [
      { id: "peppol", label: "Peppol e-facturatie (UBL) ingebouwd", verified: true },
      { id: "avg", label: "AVG-proof", verified: false },
    ];
    expect(visibleTrustBadges(badges).map((badge) => badge.label)).toEqual([
      "Peppol e-facturatie (UBL) ingebouwd",
    ]);
    expect(visibleTrustBadges().map((badge) => badge.id)).toEqual(["peppol", "approval", "market", "pricing"]);
  });

  it("publiceert geen review zonder toestemming of tekst, en de live lijst is leeg", () => {
    const items: Review[] = [
      { name: "A", company: "B", industry: "C", quote: "Echt", consent: true },
      { name: "D", company: "E", industry: "F", quote: "Zonder toestemming", consent: false },
      { name: " ", company: "G", industry: "H", quote: "Leeg", consent: true },
    ];
    expect(publishedReviews(items)).toEqual([items[0]]);
    expect(publishedReviews()).toEqual([]);
  });
});
