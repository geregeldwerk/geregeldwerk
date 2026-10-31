"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QuoteSheet } from "@/components/quote-sheet";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import type { CompanySettings, Quote } from "@/lib/domain/types";

export function PrintQuoteClient({ id }: { id: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<{ quote: Quote }>(`/api/quotes/${id}`),
      api<{ settings: CompanySettings }>("/api/settings"),
    ])
      .then(([quoteData, settingsData]) => {
        setQuote(quoteData.quote);
        setSettings(settingsData.settings);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }, [id]);

  return (
    <div className="min-h-full bg-neutral-200 px-4 py-6">
      <div className="no-print mx-auto mb-4 flex max-w-3xl flex-wrap gap-2">
        <Button variant="outline" className="h-10" nativeButton={false} render={<Link href={`/offertes/${id}`} />}>
          Terug
        </Button>
        <Button className="h-10" type="button" onClick={() => window.print()}>
          Afdrukken of opslaan als PDF
        </Button>
      </div>
      {error ? <p className="mx-auto max-w-3xl text-sm">{error}</p> : null}
      {!quote || !settings ? <p className="mx-auto max-w-3xl text-sm">Offerte laden…</p> : <QuoteSheet quote={quote} settings={settings} />}
    </div>
  );
}
