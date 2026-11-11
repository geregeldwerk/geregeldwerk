import Link from "next/link";
import { Suspense } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { BottomNav, Nav } from "@/components/nav";
import { EmergencyBanner } from "@/components/emergency-banner";
import { ThemeToggle } from "@/components/theme-toggle";

export default function WerkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EmergencyBanner />
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <BrandLockup href="/app" />
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
        GeregeldWerk is een product van CodedByDefault. Deze prototype draait lokaal. In mock-modus
        verlaat een bericht je computer niet. Zet hier geen echte klantgegevens in (AVG).{" "}
        <Link href="/" className="underline">
          Productpagina
        </Link>
        {" · "}
        <Link href="/permissies" className="underline">
          Permissies
        </Link>
        {" · "}
        <Link href="/app/wachtlijst" className="underline">
          Wachtlijst
        </Link>
      </footer>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
