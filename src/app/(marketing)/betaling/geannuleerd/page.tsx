import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";

export default function PaymentCanceledPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <BrandLockup href="/" />
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Betaling</p>
        <h1 className="mt-2 text-4xl tracking-tight">Niets afgeschreven</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Je hebt de kassa gesloten voordat de betaling rond was. Er is geen abonnement gestart.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/#prijzen" className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Terug naar de prijzen
        </Link>
        <Link href="/app" className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold">
          Naar de app
        </Link>
      </div>
    </main>
  );
}
