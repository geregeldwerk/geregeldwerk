import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <BrandLockup href="/" />
      <div>
        <h1 className="font-heading text-4xl">Pagina niet gevonden</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Deze route bestaat niet in GeregeldWerk.</p>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/" className="underline">
          Naar de productpagina
        </Link>
        <Link href="/app" className="underline">
          Naar de app
        </Link>
      </div>
    </main>
  );
}
