import { calculateTotals, formatEuro, lineTotalCents } from "@/lib/domain/money";
import { STATUS_LABEL, type CompanySettings, type Quote } from "@/lib/domain/types";
import { settingsLookPlaceholder } from "@/lib/storage/seed";

export function QuoteSheet({ quote, settings }: { quote: Quote; settings: CompanySettings }) {
  const totals = calculateTotals(quote.lines, quote.vatRate);
  const title = quote.status === "concept" ? "Conceptofferte" : "Offerte";
  const dated = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(quote.updatedAt));

  return (
    <article className="quote-sheet mx-auto max-w-3xl bg-white px-6 py-8 text-neutral-900 shadow-sm ring-1 ring-black/10 sm:px-10 sm:py-12">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.16em] text-neutral-500 uppercase">Geregeldwerk</p>
          <h1 className="mt-1 font-heading text-3xl text-neutral-950">{title}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {quote.number} · {STATUS_LABEL[quote.status]} · {dated}
          </p>
        </div>
        <div className="text-sm leading-6 sm:text-right">
          <p className="font-medium">{settings.companyName}</p>
          <p>{settings.contactName}</p>
          <p>{settings.address}</p>
          <p>
            {settings.postalCode} {settings.city}
          </p>
          <p>{settings.email}</p>
          <p>{settings.phone}</p>
        </div>
      </header>

      {quote.example ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Fictief voorbeeld. Dit is geen echte klant en geen verzendklaar document.
        </p>
      ) : null}

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-xs tracking-wide text-neutral-500 uppercase">Klant</h2>
          <p className="mt-1 font-medium">{quote.customerName || "Naam ontbreekt"}</p>
          <p>{quote.location || "Plaats ontbreekt"}</p>
          {quote.customerPhone ? <p>{quote.customerPhone}</p> : null}
          {quote.customerEmail ? <p>{quote.customerEmail}</p> : null}
          <p className="mt-2 text-sm text-neutral-600">
            Gewenste datum: {quote.requestedDate || "niet genoemd"}
          </p>
        </div>
        <div>
          <h2 className="text-xs tracking-wide text-neutral-500 uppercase">Werk</h2>
          <p className="mt-1 text-sm leading-6">{quote.jobDescription || "Nog geen omschrijving."}</p>
        </div>
      </section>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs tracking-wide text-neutral-500 uppercase">
              <th className="py-2 font-medium">Omschrijving</th>
              <th className="py-2 font-medium">Aantal</th>
              <th className="py-2 font-medium">Prijs</th>
              <th className="py-2 text-right font-medium">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id} className="border-b border-neutral-200">
                <td className="py-3 pr-3">{line.description}</td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {formatQuantity(line.quantity)} {line.unit}
                </td>
                <td className="py-3 pr-3 whitespace-nowrap">
                  {line.unitPriceCents == null ? "prijs ontbreekt" : formatEuro(line.unitPriceCents)}
                </td>
                <td className="py-3 text-right whitespace-nowrap tabular-nums">
                  {line.unitPriceCents == null
                    ? "—"
                    : formatEuro(lineTotalCents(line.quantity, line.unitPriceCents))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto w-full max-w-xs text-sm">
        <div className="flex justify-between py-1">
          <dt>Subtotaal</dt>
          <dd className="tabular-nums">{formatEuro(totals.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt>BTW {Math.round(quote.vatRate * 100)}%</dt>
          <dd className="tabular-nums">{formatEuro(totals.vatCents)}</dd>
        </div>
        <div className="flex justify-between border-t border-neutral-300 py-2 font-medium">
          <dt>Totaal</dt>
          <dd className="tabular-nums">{formatEuro(totals.totalCents)}</dd>
        </div>
      </dl>
      {totals.missingPriceCount > 0 ? (
        <p className="mt-2 text-sm text-amber-900">
          {totals.missingPriceCount === 1
            ? "1 regel heeft geen prijs en telt niet mee. Dit is nog geen verzendklare offerte."
            : `${totals.missingPriceCount} regels hebben geen prijs en tellen niet mee. Dit is nog geen verzendklare offerte.`}
        </p>
      ) : null}

      {quote.notes ? (
        <p className="mt-6 text-sm leading-6">
          <span className="font-medium">Opmerking. </span>
          {quote.notes}
        </p>
      ) : null}

      <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-600">
        <p>
          Deze offerte is {settings.quoteValidityDays} dagen geldig. KvK {settings.kvk} · BTW {settings.btw} ·
          IBAN {settings.iban}
        </p>
        <p className="mt-1">{settings.footerNote}</p>
        {settingsLookPlaceholder(settings) ? (
          <p className="mt-1">Bedrijfsgegevens zijn placeholders. Vul je eigen gegevens in bij Instellingen.</p>
        ) : null}
      </footer>
    </article>
  );
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(quantity);
}
