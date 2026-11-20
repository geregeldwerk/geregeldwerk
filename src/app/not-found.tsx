import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";

export default function NotFound() {
  return (
    <main id="inhoud" className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <BrandLockup href="/" />
      <div className="rounded-3xl border border-border bg-card px-5 py-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">404</p>
        <h1 className="mt-2 text-4xl tracking-tight">Pagina niet gevonden</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">Deze route bestaat niet in GeregeldWerk.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Naar de productpagina
          </Link>
          <Link href="/app" className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary">
            Naar de app
          </Link>
        </div>
      </div>
    </main>
  );
}
