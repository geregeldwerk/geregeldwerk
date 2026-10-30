"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ErrorNote, LoadingNote } from "@/components/feedback";
import { QuoteEditor } from "@/components/quote-editor";
import { api } from "@/lib/client/api";
import type { Approval, CompanySettings, Quote } from "@/lib/domain/types";

export default function QuotePage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, setPending] = useState<Approval[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api<{ quote: Quote; pendingApprovals: Approval[] }>(`/api/quotes/${params.id}`),
      api<{ settings: CompanySettings }>("/api/settings"),
    ])
      .then(([quoteData, settingsData]) => {
        if (cancelled) return;
        setQuote(quoteData.quote);
        setPending(quoteData.pendingApprovals);
        setSettings(settingsData.settings);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Offerte laden mislukt.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) return <ErrorNote message={error} />;
  if (!quote || !settings) return <LoadingNote label="Offerte laden…" />;
  return <QuoteEditor key={quote.updatedAt} initialQuote={quote} pending={pending} settings={settings} />;
}
