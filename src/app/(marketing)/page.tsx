import type { Metadata } from "next";
import Link from "next/link";
import { BrandCheck } from "@/components/brand-check";
import { BrandLockup } from "@/components/brand-lockup";
import { PricingSection } from "@/components/pricing-section";
import { Reviews } from "@/components/reviews";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrustBadges } from "@/components/trust-badges";
import { billingCatalog } from "@/lib/billing/seed";

export const metadata: Metadata = {
  title: { absolute: "GeregeldWerk – Van aanvraag naar offerte. Slim geregeld." },
  description:
    "GeregeldWerk is een SaaS-platform voor slimme offerteautomatisering. Aanvragen komen binnen via e-mail, WhatsApp of een online aanvraagformulier. Jij doet het werk, wij doen de rest.",
};

const reasons = [
  "van aanvraag naar offerte in minuten",
  "één inbox voor e-mail, WhatsApp en formulier",
  "er gaat niets weg zonder jouw goedkeuring",
  "eigen huisstijl, tarieven, btw en voorwaarden",
  "klantenbeheer en offertehistorie centraal",
  "automatische opvolging",
  "dashboard met conversies",
  "eigen beveiligde omgeving per bedrijf",
  "Peppol e-facturatie",
  "Nederlandstalig, voor NL en BE",
];

const steps = [
  {
    title: "Aanvraag komt binnen",
    text: "Via e-mail, WhatsApp of het online aanvraagformulier.",
  },
  {
    title: "AI maakt een conceptofferte",
    text: "Op basis van je bedrijfsgegevens, diensten, tarieven en voorwaarden.",
  },
  {
    title: "Jij keurt goed en verstuurt",
    text: "Je controleert, past aan en verstuurt pas na jouw goedkeuring.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <BrandLockup href="/" className="min-w-0" />
          <nav aria-label="Pagina" className="hidden items-center gap-5 text-sm lg:flex">
            <a href="#waarom" className="hover:text-primary">Waarom</a>
            <a href="#werking" className="hover:text-primary">Zo werkt het</a>
            <a href="#prijzen" className="hover:text-primary">Prijzen</a>
            <a href="#uitbreidingen" className="hover:text-primary">Uitbreidingen</a>
            <a href="#contact" className="hover:text-primary">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/app" className="hidden h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold sm:inline-flex">
              Inloggen
            </Link>
            <Link href="/app" className="inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
              Probeer gratis
            </Link>
          </div>
        </div>
        <nav aria-label="Pagina" className="flex gap-4 overflow-x-auto px-4 pb-3 text-sm lg:hidden">
          <a href="#waarom" className="shrink-0">Waarom</a>
          <a href="#werking" className="shrink-0">Zo werkt het</a>
          <a href="#prijzen" className="shrink-0">Prijzen</a>
          <a href="#uitbreidingen" className="shrink-0">Uitbreidingen</a>
          <a href="#contact" className="shrink-0">Contact</a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:py-20">
          <BrandLockup href="/" size="hero" />
          <div className="max-w-3xl">
            <h1 className="text-4xl tracking-tight text-balance sm:text-6xl">
              <span className="wordmark block text-sm text-primary sm:text-base">GeregeldWerk</span>
              <span className="mt-3 block">Van aanvraag naar offerte. Slim geregeld.</span>
            </h1>
            <p className="mt-5 text-sm font-semibold tracking-[0.16em] text-primary uppercase">
              Jij doet het werk, wij doen de rest
            </p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              GeregeldWerk is een SaaS-platform voor slimme offerteautomatisering. Aanvragen komen binnen via e-mail, WhatsApp of een online aanvraagformulier. AI herkent de werkzaamheden en klantgegevens en maakt op basis van de ingestelde bedrijfsgegevens, diensten, tarieven en voorwaarden een professionele conceptofferte. De ondernemer controleert, past aan en keurt goed voordat de offerte verstuurd wordt.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/app" className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
                Probeer gratis
              </Link>
              <Link href="/app" className="inline-flex h-12 items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold">
                Inloggen
              </Link>
            </div>
          </div>
          <TrustBadges />
        </section>

        <section id="waarom" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Waarom GeregeldWerk anders is</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4">
                <BrandCheck className="mt-0.5" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="werking" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 py-12">
          <h2 className="text-3xl tracking-tight sm:text-4xl">Zo werkt het</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-3xl border border-border bg-card p-5">
                <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">Stap {index + 1}</p>
                <h3 className="mt-3 font-heading text-2xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
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
            Vier pakketten. Jaarlijks scheelt twee maanden. De knoppen openen GeregeldWerk; er is nog geen betaalstap.
          </p>
          <div className="mt-8">
            <PricingSection catalog={billingCatalog} />
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
              Op deze pagina nog niet. De bedragen zijn exclusief btw. Probeer gratis en Inloggen openen de app, zonder betaalstap.
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
