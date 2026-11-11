import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandCheck } from "@/components/brand-check";
import { BrandLockup } from "@/components/brand-lockup";
import { PricingSection } from "@/components/pricing-section";
import { Reviews } from "@/components/reviews";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrustBadges } from "@/components/trust-badges";
import { billingCatalog } from "@/lib/billing/seed";
import { launchMode } from "@/lib/launch";
import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: { absolute: "GeregeldWerk – Van aanvraag naar offerte. Slim geregeld." },
  description:
    "GeregeldWerk is een SaaS-platform voor slimme offerteautomatisering. Aanvragen komen binnen via e-mail, WhatsApp of een online aanvraagformulier. Jij doet het werk, wij doen de rest.",
};

const reasons: Array<{ text: string; icon?: string; soon?: boolean }> = [
  { text: "van aanvraag naar offerte in minuten", icon: "/brand/iconen/van-bericht-naar-offerte.svg", soon: true },
  { text: "één inbox voor e-mail, WhatsApp en formulier", icon: "/brand/iconen/alle-kanalen.svg", soon: true },
  { text: "er gaat niets weg zonder jouw goedkeuring", icon: "/brand/iconen/jij-houdt-de-controle.svg" },
  { text: "eigen huisstijl, tarieven, btw en voorwaarden" },
  { text: "klantenbeheer en offertehistorie centraal", icon: "/brand/iconen/minder-admin.svg", soon: true },
  { text: "automatische opvolging", icon: "/brand/iconen/tijdwinst.svg", soon: true },
  { text: "dashboard met conversies", soon: true },
  { text: "eigen beveiligde omgeving per bedrijf", soon: true },
  { text: "Peppol e-facturatie" },
  { text: "Nederlandstalig, voor NL en BE", icon: "/brand/iconen/nl-be-proof.svg" },
];

const steps = [
  {
    title: "Aanvraag komt binnen",
    text: "Via e-mail, WhatsApp of het online aanvraagformulier.",
    image: "/landing/stap-1-aanvraag.webp",
  },
  {
    title: "AI maakt een conceptofferte",
    text: "Op basis van je bedrijfsgegevens, diensten, tarieven en voorwaarden.",
    image: "/landing/stap-2-concept.webp",
  },
  {
    title: "Jij keurt goed en verstuurt",
    text: "Je controleert, past aan en verstuurt pas na jouw goedkeuring.",
    image: "/landing/stap-3-goedkeuren.webp",
  },
];

export default function LandingPage() {
  const mode = launchMode();
  const waitlist = mode === "waitlist";
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <BrandLockup href="/" className="min-w-0" />
          <nav aria-label="Pagina" className="hidden items-center gap-5 text-sm lg:flex">
            <a href="#wachtlijst" className="hover:text-primary">Early access</a>
            <a href="#waarom" className="hover:text-primary">Waarom</a>
            <a href="#werking" className="hover:text-primary">Zo werkt het</a>
            <a href="#prijzen" className="hover:text-primary">Prijzen</a>
            <a href="#uitbreidingen" className="hover:text-primary">Uitbreidingen</a>
            <a href="#contact" className="hover:text-primary">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/app" className={waitlist ? "hidden text-sm text-muted-foreground underline-offset-4 hover:underline sm:inline" : "hidden h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold sm:inline-flex"}>
              Inloggen
            </Link>
            {waitlist ? (
              <a href="#wachtlijst" className="inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                Zet me op de wachtlijst
              </a>
            ) : (
              <Link href="/app" className="inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                Naar de app
              </Link>
            )}
          </div>
        </div>
        <nav aria-label="Pagina" className="flex gap-4 overflow-x-auto px-4 pb-3 text-sm lg:hidden">
          <Link href="/app" className="shrink-0 text-muted-foreground">Inloggen</Link>
          <a href="#wachtlijst" className="shrink-0">Early access</a>
          <a href="#waarom" className="shrink-0">Waarom</a>
          <a href="#werking" className="shrink-0">Zo werkt het</a>
          <a href="#prijzen" className="shrink-0">Prijzen</a>
          <a href="#uitbreidingen" className="shrink-0">Uitbreidingen</a>
          <a href="#contact" className="shrink-0">Contact</a>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 hidden md:block">
            <Image
              src="/landing/hero-vakman.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[72%_center]"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_34%,color-mix(in_srgb,var(--background)_70%,transparent)_52%,transparent_74%)]" />
          </div>
          <div className="relative mx-auto flex w-full max-w-6xl items-center px-4 py-14 sm:py-20 md:min-h-[36rem]">
            <div className="max-w-xl">
              <h1 className="text-4xl tracking-tight text-balance sm:text-6xl">
                <span className="wordmark block text-sm text-primary sm:text-base">GeregeldWerk</span>
                <span className="mt-3 block">Van aanvraag naar offerte. Slim geregeld.</span>
              </h1>
              <p className="mt-5 text-sm font-semibold tracking-[0.16em] text-primary uppercase">
                Jij doet het werk, wij doen de rest
              </p>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                GeregeldWerk is een SaaS-platform voor slimme offerteautomatisering. Aanvragen komen binnen via e-mail, WhatsApp of een online aanvraagformulier. AI herkent de werkzaamheden en klantgegevens en maakt op basis van de ingestelde bedrijfsgegevens, diensten, tarieven en voorwaarden een professionele conceptofferte. De ondernemer controleert, past aan en keurt goed voordat de offerte verstuurd wordt.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {waitlist ? (
                  <a href="#wachtlijst" className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
                    Schrijf je in voor early access
                  </a>
                ) : (
                  <>
                    <Link href="/app" className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
                      Naar de app
                    </Link>
                    <Link href="/app" className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-background px-5 text-sm font-semibold">
                      Inloggen
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="px-4 pb-2 md:hidden">
            <Image
              src="/landing/hero-vakman.webp"
              alt="Vakman bekijkt op zijn telefoon hoe een bericht een offerte wordt"
              width={1920}
              height={1080}
              priority
              sizes="100vw"
              className="aspect-video w-full rounded-3xl object-cover object-[68%_center]"
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10">
          <TrustBadges />
        </section>

        <section id="waarom" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Waarom GeregeldWerk anders is</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {reasons.map((reason) => (
              <li key={reason.text} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4">
                {reason.icon ? (
                  <Image src={reason.icon} alt="" width={32} height={32} unoptimized className="size-8 shrink-0" />
                ) : (
                  <BrandCheck className="mt-1 size-5" />
                )}
                <span className="min-w-0">
                  <span className="block">{reason.text}</span>
                  {waitlist && reason.soon ? (
                    <span className="mt-1 inline-block text-xs font-semibold tracking-wide text-primary uppercase">Bij lancering</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {waitlist ? (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
              GeregeldWerk is in ontwikkeling. Wat je hier ziet is de richting. Vroege aanmelders krijgen als eerste toegang.
            </p>
          ) : null}
        </section>

        <section id="wachtlijst" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Early access</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            We verkopen nog niets. Laat je gegevens achter, dan hoor je het als GeregeldWerk opent.
          </p>
          <div className="mt-6 max-w-3xl">
            <WaitlistForm />
          </div>
        </section>

        <section id="werking" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Zo werkt het</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="overflow-hidden rounded-3xl border border-border bg-card">
                <Image
                  src={step.image}
                  alt=""
                  width={1200}
                  height={1200}
                  sizes="(min-width: 768px) 30vw, 100vw"
                  className="aspect-square w-full object-cover"
                />
                <div className="p-5">
                  <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">Stap {index + 1}</p>
                  <h3 className="mt-3 font-heading text-2xl">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-12">
          <Reviews />
        </section>

        <section id="prijzen" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Prijzen</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {waitlist
              ? "Verwachte prijzen bij lancering. Je koopt nu nog niets."
              : "Vier pakketten. Jaarlijks scheelt twee maanden. De pakketknoppen openen de Stripe-testkassa. Enterprise blijft contact."}
          </p>
          <div className="mt-8">
            <PricingSection catalog={billingCatalog} mode={mode} />
          </div>
        </section>

        <section id="contact" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Enterprise</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Prijs op aanvraag. Deze pagina verstuurt geen formulier en bewaart niets. De knop opent je eigen mailprogramma.
          </p>
          <a
            href={billingCatalog.enterpriseMailto}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Neem contact op
          </a>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Vragen</h2>
          <div className="mt-6 grid gap-3">
            <Faq question="Voor wie is GeregeldWerk?">
              Voor ondernemers in Nederland en België die van een aanvraag een offerte willen maken, in het Nederlands.
            </Faq>
            <Faq question="Gaat er iets weg zonder mijn goedkeuring?">
              Nee. Je controleert de conceptofferte en keurt goed voordat die naar de klant gaat.
            </Faq>
            <Faq question="Hoe betaal ik?">
              {waitlist
                ? "Nu nog niet. De bedragen zijn verwachte prijzen bij lancering, exclusief btw. De knoppen zetten je op de wachtlijst."
                : "Starter, Professional en Business openen de kassa. Jaarlijks betalen geeft 2 maanden voordeel: 12 maanden voor de prijs van 10. Alle prijzen zijn exclusief btw."}
            </Faq>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="wordmark text-sm text-foreground">
              Geregeld<span className="text-primary">Werk</span>
            </p>
            <p className="mt-2">Jij doet het werk, wij doen de rest</p>
            <p className="mt-2">GeregeldWerk is een product van CodedByDefault.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <a href="#prijzen">Prijzen</a>
            <a href="#contact">Contact</a>
            <Link href="/app">Naar de app</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Faq({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="rounded-2xl border border-border bg-card px-4 py-3">
      <summary className="cursor-pointer font-medium">{question}</summary>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </details>
  );
}
