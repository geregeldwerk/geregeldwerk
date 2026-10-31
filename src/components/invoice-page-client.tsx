"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorNote, LoadingNote } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { formatEuro } from "@/lib/domain/money";
import type { Invoice, Quote } from "@/lib/domain/types";
import { SCENARIO_LABEL, SEND_STATUS_LABEL } from "@/lib/peppol/spec";

interface PeppolIssue {
  rule: string;
  message: string;
}

interface InvoicePayload {
  invoice: Invoice;
  quote: Quote | null;
  validation: { ok: boolean; issues: PeppolIssue[] };
}

export function InvoicePageClient() {
  const params = useParams<{ id: string }>();
  const [payload, setPayload] = useState<InvoicePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    setError(null);
    void api<InvoicePayload>(`/api/facturen/${params.id}`)
      .then(setPayload)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Factuur laden mislukt."));
  }

  useEffect(() => {
    let cancelled = false;
    void api<InvoicePayload>(`/api/facturen/${params.id}`)
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Factuur laden mislukt.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function send() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ result: { message: string } }>(`/api/facturen/${params.id}/verstuur`, {
        method: "POST",
      });
      setNotice(result.result.message);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verzenden mislukt.");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (error && !payload) return <ErrorNote message={error} />;
  if (!payload) return <LoadingNote label="Factuur laden…" />;

  const { invoice, validation } = payload;
  const lines = invoice.lines ?? payload.quote?.lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    unitPriceCents: line.unitPriceCents ?? 0,
    lineCents: 0,
  })) ?? [];
  const status = invoice.sendStatus ?? "niet_verstuurd";
  const scenario = invoice.vatScenario ?? "standaard";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/boekhouding" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Alle facturen
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">E-factuur · Peppol BIS 3.0</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">{invoice.number}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {invoice.customerName}
            {invoice.example ? " · voorbeeld" : ""} · {formatEuro(invoice.totalCents)} incl. btw
          </p>
        </div>
        <p className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">{SEND_STATUS_LABEL[status]}</p>
      </div>

      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      {error ? <ErrorNote message={error} /> : null}
      {!validation.ok ? (
        <ErrorNote
          message="Deze factuur is nog niet geldig als Peppol-factuur."
          issues={validation.issues.map((issue) => issue.message)}
        />
      ) : (
        <p className="rounded-xl bg-secondary px-4 py-3 text-sm">De UBL voldoet aan de controles van deze app voor Peppol BIS Billing 3.0.</p>
      )}

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <div>
          <h2 className="font-heading text-xl">Verkoper</h2>
          <p className="mt-2 text-sm">{invoice.sellerName || "Bedrijf uit instellingen"}</p>
          <p className="text-sm text-muted-foreground">
            {invoice.sellerCountry || "NL"} · {invoice.sellerEndpointScheme || "—"}:{invoice.sellerEndpointId || "—"}
          </p>
        </div>
        <div>
          <h2 className="font-heading text-xl">Koper</h2>
          <p className="mt-2 text-sm">{invoice.customerName}</p>
          <p className="text-sm text-muted-foreground">
            {invoice.buyerCountry || "NL"} · {invoice.buyerEndpointScheme || "—"}:{invoice.buyerEndpointId || "—"}
          </p>
        </div>
        <dl className="text-sm sm:col-span-2">
          <div className="flex justify-between py-1"><dt>Factuurdatum</dt><dd>{invoice.issueDate || "—"}</dd></div>
          <div className="flex justify-between py-1"><dt>Vervaldatum</dt><dd>{invoice.dueDate || "—"}</dd></div>
          <div className="flex justify-between py-1"><dt>Btw</dt><dd>{SCENARIO_LABEL[scenario]}</dd></div>
          <div className="flex justify-between py-1"><dt>Referentie koper</dt><dd>{invoice.buyerReference || "—"}</dd></div>
        </dl>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Factuurregels</caption>
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Omschrijving</th>
              <th className="px-4 py-3 font-medium">Aantal</th>
              <th className="px-4 py-3 font-medium">Prijs</th>
              <th className="px-4 py-3 text-right font-medium">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.description}-${index}`} className="border-t border-border">
                <td className="px-4 py-3">{line.description}</td>
                <td className="px-4 py-3 tabular-nums">{line.quantity} {line.unit}</td>
                <td className="px-4 py-3 tabular-nums">{formatEuro(line.unitPriceCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatEuro(line.lineCents || Math.round(line.quantity * line.unitPriceCents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ml-auto w-full max-w-xs text-sm">
        <div className="flex justify-between py-1"><dt>Excl. btw</dt><dd className="tabular-nums">{formatEuro(invoice.amountCents)}</dd></div>
        <div className="flex justify-between py-1"><dt>Btw</dt><dd className="tabular-nums">{formatEuro(invoice.vatCents)}</dd></div>
        <div className="flex justify-between border-t py-2 font-medium"><dt>Te betalen</dt><dd className="tabular-nums">{formatEuro(invoice.totalCents)}</dd></div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button nativeButton={false} className="h-10" render={<a href={`/api/facturen/${invoice.id}/ubl`} />}>
          Download UBL-XML
        </Button>
        <Button type="button" variant="secondary" className="h-10" disabled={busy || status === "verstuurd_mock"} onClick={() => void send()}>
          {busy ? "Bezig…" : "Verstuur via Peppol (mock)"}
        </Button>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Verzenden blijft in de mock. Er wordt geen Access Point aangeroepen en er gaat niets naar het Peppol-netwerk.
        {invoice.transmissionId ? ` Kenmerk: ${invoice.transmissionId}.` : ""}
        {invoice.sendMessage ? ` ${invoice.sendMessage}` : ""}
      </p>
      {!invoice.ublXml ? (
        <p className="text-sm text-muted-foreground">
          Deze factuur heeft nog geen vastgezette UBL. De XML wordt opgebouwd uit de huidige offerte en bedrijfsgegevens.
        </p>
      ) : null}
    </div>
  );
}
