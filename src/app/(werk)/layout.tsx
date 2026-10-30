import Link from "next/link";
import { EmergencyBanner } from "@/components/emergency-banner";
import { Nav } from "@/components/nav";

export default function WerkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EmergencyBanner />
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-heading text-lg text-primary-foreground">
              G
            </span>
            <span>
              <span className="block font-heading text-xl leading-none tracking-tight">Geregeldwerk</span>
              <span className="text-xs text-muted-foreground">Jij doet het werk, wij regelen de rest!</span>
            </span>
          </Link>
          <Nav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs leading-5 text-muted-foreground">
        Geregeldwerk is een product van CodedByDefault. Deze prototype draait lokaal. In mock-modus
        verlaat een bericht je computer niet. Zet hier geen echte klantgegevens in (AVG).{" "}
        <Link href="/permissies" className="underline">
          Permissies
        </Link>
      </footer>
    </div>
  );
}
