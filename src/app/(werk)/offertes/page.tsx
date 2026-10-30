"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExampleBadge, StatusBadge } from "@/components/status-badge";
import { EmptyNote, ErrorNote, LoadingNote } from "@/components/feedback";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client/api";
import { calculateTotals, formatEuro } from "@/lib/domain/money";
import { QUOTE_STATUSES, STATUS_LABEL, type Quote, type QuoteStatus } from "@/lib/domain/types";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "alles">("alles");

  function load() {
    void api<{ quotes: Quote[] }>("/api/quotes")
      .then((data) => {
        setQuotes(data.quotes);
        setError(null);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    load();
  }, []);

  const visible = (quotes ?? []).filter((quote) => {
    const haystack = `${quote.number} ${quote.customerName} ${quote.location} ${quote.jobDescription}`.toLocaleLowerCase("nl-NL");
    const matchesQuery = haystack.includes(query.trim().toLocaleLowerCase("nl-NL"));
    const matchesStatus = status === "alles" || quote.status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Offertes</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Concept, verstuurd, geaccepteerd</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Een concept bewaar je direct. Versturen loopt via de permissie en verschijnt in Toezicht als het buiten de grenzen valt.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op klant, plaats of nummer"
          aria-label="Zoek offertes"
          className="h-10 sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter op status">
          <FilterButton active={status === "alles"} onClick={() => setStatus("alles")}>
            Alles
          </FilterButton>
          {QUOTE_STATUSES.map((item) => (
            <FilterButton key={item} active={status === item} onClick={() => setStatus(item)}>
              {STATUS_LABEL[item]}
            </FilterButton>
          ))}
        </div>
      </div>
      {error ? <ErrorNote message={error} onRetry={load} /> : null}
      {quotes === null && !error ? <LoadingNote label="Offertes laden…" /> : null}
      {quotes && visible.length === 0 ? (
        <EmptyNote
          title="Geen offertes in deze selectie"
          text="Maak een concept vanuit een klantbericht, of kies een andere status."
        />
      ) : null}
      <ul className="grid gap-3">
        {visible.map((quote) => {
          const totals = calculateTotals(quote.lines, quote.vatRate);
          return (
            <li key={quote.id}>
              <Link
                href={`/offertes/${quote.id}`}
                className="block rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{quote.number}</span>
                  <StatusBadge status={quote.status} />
                  {quote.example ? <ExampleBadge /> : null}
                  <span className="ml-auto text-sm tabular-nums">
                    {totals.complete ? formatEuro(totals.totalCents) : "Prijs incompleet"}
                  </span>
                </div>
                <p className="mt-2 font-heading text-xl">{quote.customerName || "Naam ontbreekt"}</p>
                <p className="text-sm text-muted-foreground">
                  {quote.location || "Plaats ontbreekt"} · {quote.jobDescription || "Geen omschrijving"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}
    >
      {children}
    </button>
  );
}
