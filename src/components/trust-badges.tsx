import { BrandCheck } from "@/components/brand-check";
import { visibleTrustBadges, type TrustBadge } from "@/lib/trust";

export function TrustBadges({ badges = visibleTrustBadges() }: { badges?: TrustBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <ul id="vertrouwen" className="grid gap-3 sm:grid-cols-2" aria-label="Waar GeregeldWerk voor staat">
      {badges.map((badge) => (
        <li key={badge.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <BrandCheck className="mt-0.5" />
          <span>{badge.label}</span>
        </li>
      ))}
    </ul>
  );
}
