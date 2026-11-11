import { Suspense } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { PaymentReference } from "./reference";

export default function PaymentSuccessPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <BrandLockup href="/" />
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Betaling</p>
        <h1 className="mt-2 text-4xl tracking-tight">Bedankt</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Als de betaling is gelukt, bevestigt Stripe dat op de server. Je abonnement verschijnt daarna bij Instellingen. Er is nog niets handmatig te doen.
        </p>
        <Suspense fallback={null}>
          <PaymentReference />
        </Suspense>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/instellingen" className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Naar instellingen
        </Link>
        <Link href="/app" className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold">
          Naar de app
        </Link>
      </div>
    </main>
  );
}
