import Link from "next/link";
import { Suspense } from "react";
import { BottomNav, Nav } from "@/components/nav";
import { EmergencyBanner } from "@/components/emergency-banner";
import { ThemeToggle } from "@/components/theme-toggle";

export default function WerkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EmergencyBanner />
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/88 shadow-[0_1px_12px_rgba(21,56,46,0.06)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-700 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 dark:to-emerald-500">
              G
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg leading-none font-semibold tracking-tight">Geregeldwerk</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">Jij doet het werk, wij doen de rest</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <Nav />
            </Suspense>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 md:pb-10">{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-28 text-xs leading-5 text-muted-foreground md:pb-8">
        Geregeldwerk is een product van CodedByDefault. Deze prototype draait lokaal. In mock-modus
        verlaat een bericht je computer niet. Zet hier geen echte klantgegevens in (AVG).{" "}
        <Link href="/permissies" className="underline">
          Permissies
        </Link>
      </footer>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
