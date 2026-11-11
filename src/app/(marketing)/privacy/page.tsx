import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Concept van de privacyverklaring van GeregeldWerk.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <p className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm font-semibold">CONCEPT – nog goed te keuren</p>
      <h1 className="mt-6 text-4xl tracking-tight">Privacy</h1>
      <div className="mt-6 flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
        <p>
          GeregeldWerk is in ontwikkeling. Deze tekst is een concept en nog niet de definitieve privacyverklaring.
        </p>
        <h2 className="font-heading text-2xl text-foreground">Welke gegevens</h2>
        <p>
          Als je je inschrijft voor early access bewaren we je naam, e-mailadres, bedrijfsnaam, branche, aantal medewerkers, land, een eventuele pakketvoorkeur en je antwoord op de vraag wat je nu de meeste tijd kost bij offertes.
        </p>
        <h2 className="font-heading text-2xl text-foreground">Doel</h2>
        <p>We gebruiken die gegevens alleen om je te informeren over de lancering van GeregeldWerk.</p>
        <h2 className="font-heading text-2xl text-foreground">Bewaartermijn</h2>
        <p>[KIES TERMIJN]</p>
        <h2 className="font-heading text-2xl text-foreground">Afmelden</h2>
        <p>Je kunt je afmelden via e-mail naar [E-MAILADRES].</p>
        <h2 className="font-heading text-2xl text-foreground">Verwerkingsverantwoordelijke</h2>
        <p>De Bumperbank / CodedByDefault, Hulst (KvK 42171617).</p>
        <p>
          <Link href="/" className="underline">Terug naar de pagina</Link>
        </p>
      </div>
    </main>
  );
}
