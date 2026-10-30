"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNote } from "@/components/feedback";
import { LineEditor } from "@/components/line-editor";
import { ExampleBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/client/api";
import { linesFromQuote, toDraftLines, type LineDraft } from "@/lib/domain/lines";
import { calculateTotals, formatEuro } from "@/lib/domain/money";
import { canMarkReady, reviewQuote } from "@/lib/domain/quote";
import type { Approval, CompanySettings, Quote } from "@/lib/domain/types";

export function QuoteEditor({
  initialQuote,
  pending,
  settings,
}: {
  initialQuote: Quote;
  pending: Approval[];
  settings: CompanySettings;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState(initialQuote);
  const [lines, setLines] = useState<LineDraft[]>(() => linesFromQuote(initialQuote.lines));
  const [customerName, setCustomerName] = useState(initialQuote.customerName);
  const [location, setLocation] = useState(initialQuote.location);
  const [phone, setPhone] = useState(initialQuote.customerPhone);
  const [email, setEmail] = useState(initialQuote.customerEmail);
  const [requestedDate, setRequestedDate] = useState(initialQuote.requestedDate);
  const [jobDescription, setJobDescription] = useState(initialQuote.jobDescription);
  const [notes, setNotes] = useState(initialQuote.notes);
  const [vatRate, setVatRate] = useState(initialQuote.vatRate);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [removeOpen, setRemoveOpen] = useState(false);

  const draftPreview = previewLines(lines);
  const review = draftPreview
    ? reviewQuote({
        ...quote,
        customerName,
        location,
        customerPhone: phone,
        customerEmail: email,
        requestedDate,
        lines: draftPreview,
        vatRate,
      })
    : null;
  const totals = draftPreview ? calculateTotals(draftPreview, vatRate) : null;

  async function persist(status?: Quote["status"]) {
    const payloadLines = toDraftLines(lines);
    const result = await api<{ quote: Quote }>(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        sourceText: quote.sourceText,
        customerName,
        customerPhone: phone,
        customerEmail: email,
        location,
        jobDescription,
        requestedDate,
        notes,
        vatRate,
        lines: payloadLines,
        status,
      }),
    });
    setQuote(result.quote);
    setLines(linesFromQuote(result.quote.lines));
    return result.quote;
  }

  async function onSave() {
    setBusy("opslaan");
    setError(null);
    setIssues([]);
    try {
      await persist();
      setNotice("Concept opgeslagen.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    setBusy("versturen");
    setError(null);
    setIssues([]);
    try {
      await persist();
      const result = await api<{ effect: string; reason: string }>("/api/acties", {
        method: "POST",
        body: JSON.stringify({ actor: "mens", payload: { type: "offerte_versturen", quoteId: quote.id } }),
      });
      if (result.effect === "uitgevoerd") {
        setQuote((current) => ({ ...current, status: "verstuurd" }));
        setNotice("Verstuurd binnen je permissie. Er is niets naar een echte klant gestuurd.");
      } else {
        setNotice(`${result.reason} Het verzoek staat in Toezicht tot je het goedkeurt.`);
      }
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function onAccept() {
    setBusy("accepteren");
    setError(null);
    try {
      const saved = await persist("geaccepteerd");
      setNotice(`${saved.number} staat op geaccepteerd.`);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function onInvoice() {
    setBusy("factuur");
    setError(null);
    try {
      const result = await api<{ effect: string; reason: string }>("/api/acties", {
        method: "POST",
        body: JSON.stringify({ actor: "mens", payload: { type: "factuur_maken", quoteId: quote.id } }),
      });
      setNotice(
        result.effect === "uitgevoerd"
          ? "Factuur gesimuleerd en opgeslagen."
          : `${result.reason} Keur de factuur goed in Toezicht.`,
      );
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function onAppointment() {
    setBusy("afspraak");
    setError(null);
    try {
      const result = await api<{ effect: string; reason: string }>("/api/acties", {
        method: "POST",
        body: JSON.stringify({
          actor: "mens",
          payload: {
            type: "afspraak_inplannen",
            title: `Bezoek ${customerName || "klant"}`,
            customerName,
            when,
            quoteId: quote.id,
          },
        }),
      });
      setNotice(
        result.effect === "uitgevoerd"
          ? "Afspraak gesimuleerd ingepland."
          : `${result.reason} De afspraak wacht in Toezicht.`,
      );
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function onPdf() {
    setBusy("pdf");
    setError(null);
    try {
      const saved = await persist();
      const { renderQuotePdf } = await import("@/lib/pdf/quote-pdf");
      const bytes = await renderQuotePdf(saved, settings);
      const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${saved.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function onDelete() {
    setBusy("wissen");
    try {
      await api(`/api/quotes/${quote.id}`, { method: "DELETE" });
      router.push("/offertes");
    } catch (caught) {
      showError(caught);
      setBusy(null);
    }
  }

  function showError(caught: unknown) {
    if (caught instanceof ApiError) {
      setError(caught.message);
      setIssues(caught.issues);
      return;
    }
    setError(caught instanceof Error ? caught.message : "Er ging iets mis.");
  }

  const ready = review ? canMarkReady({ ...quote, customerName, lines: draftPreview ?? [], vatRate, location, customerPhone: phone, customerEmail: email, requestedDate }) : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/offertes" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Alle offertes
        </Link>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{quote.number}</p>
          <h1 className="mt-1 font-heading text-4xl">{customerName || "Naamloze offerte"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={quote.status} />
          {quote.example ? <ExampleBadge /> : null}
        </div>
      </div>
      {quote.example ? (
        <p className="rounded-xl bg-secondary px-4 py-3 text-sm">Fictief voorbeeld. Geen echte klant.</p>
      ) : null}
      {pending.length > 0 ? (
        <p className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm">
          {pending.length === 1 ? "Er staat 1 actie" : `Er staan ${pending.length} acties`} voor deze offerte in de wachtrij.{" "}
          <Link href="/toezicht" className="underline">
            Open Toezicht
          </Link>
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <ErrorNote message={error} issues={issues} /> : null}
      {review && (review.blockers.length > 0 || review.warnings.length > 0) ? (
        <div className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm">
          {review.blockers.length > 0 ? (
            <ul className="list-disc pl-5">
              {review.blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {review.warnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {review.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Klant" id="customerName">
          <Input id="customerName" className="h-10" autoComplete="off" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        </Field>
        <Field label="Plaats of adres" id="location">
          <Input id="location" className="h-10" autoComplete="off" value={location} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field label="Telefoon" id="phone">
          <Input id="phone" className="h-10" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="E-mail" id="email">
          <Input id="email" className="h-10" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Gewenste datum" id="requestedDate">
          <Input id="requestedDate" className="h-10" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} />
        </Field>
        <Field label="BTW" id="vatRate">
          <select id="vatRate" className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm" value={String(vatRate)} onChange={(event) => setVatRate(Number(event.target.value))}>
            <option value="0.21">21%</option>
            <option value="0.09">9%</option>
            <option value="0">0%</option>
          </select>
        </Field>
      </div>
      <Field label="Omschrijving" id="jobDescription">
        <Textarea id="jobDescription" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
      </Field>
      <LineEditor lines={lines} onChange={setLines} />
      <Field label="Opmerking" id="notes">
        <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {totals ? (
        <dl className="ml-auto w-full max-w-xs text-sm">
          <div className="flex justify-between py-1"><dt>Subtotaal</dt><dd className="tabular-nums">{formatEuro(totals.subtotalCents)}</dd></div>
          <div className="flex justify-between py-1"><dt>BTW {Math.round(vatRate * 100)}%</dt><dd className="tabular-nums">{formatEuro(totals.vatCents)}</dd></div>
          <div className="flex justify-between border-t py-2 font-medium"><dt>Totaal</dt><dd className="tabular-nums">{formatEuro(totals.totalCents)}</dd></div>
          {totals.missingPriceCount > 0 ? <p className="text-xs text-warning-foreground">Regels zonder prijs tellen niet mee.</p> : null}
        </dl>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" className="h-10" disabled={busy !== null} onClick={() => void onSave()}>
          {busy === "opslaan" ? "Opslaan…" : "Concept opslaan"}
        </Button>
        <Button type="button" variant="secondary" className="h-10" disabled={busy !== null || !ready || quote.status === "verstuurd" || quote.status === "geaccepteerd"} onClick={() => void onSend()}>
          {busy === "versturen" ? "Bezig…" : "Versturen via permissie"}
        </Button>
        <Button type="button" variant="outline" className="h-10" disabled={busy !== null || quote.status !== "verstuurd" || !ready} onClick={() => void onAccept()}>
          Markeer geaccepteerd
        </Button>
        <Button type="button" variant="outline" className="h-10" disabled={busy !== null || (quote.status !== "verstuurd" && quote.status !== "geaccepteerd")} onClick={() => void onInvoice()}>
          Factuur voorstellen
        </Button>
        <Button type="button" variant="outline" className="h-10" disabled={busy !== null} onClick={() => void onPdf()}>
          Download PDF
        </Button>
        <Button type="button" variant="outline" className="h-10" render={<Link href={`/offertes/${quote.id}/afdrukken`} />}>
          Afdrukken
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={() => setRemoveOpen(true)}>
          Verwijderen
        </Button>
      </div>

      <form
        className="rounded-2xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onAppointment();
        }}
      >
        <h2 className="font-heading text-xl">Afspraak inplannen</h2>
        <p className="mt-1 text-sm text-muted-foreground">Gesimuleerd. Binnen de permissie direct, anders naar de wachtrij.</p>
        <Label htmlFor="when" className="mt-3">Moment</Label>
        <Input id="when" className="mt-1.5 h-10" value={when} onChange={(event) => setWhen(event.target.value)} placeholder="dinsdag 10:00" />
        <Button type="button" variant="outline" className="mt-3 h-10" disabled={busy !== null || !when.trim() || !customerName.trim()} onClick={() => void onAppointment()}>
          {busy === "afspraak" ? "Bezig…" : "Afspraak voorstellen"}
        </Button>
      </form>

      {quote.sourceText ? (
        <details className="rounded-xl bg-muted px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Oorspronkelijk bericht</summary>
          <p className="mt-2 whitespace-pre-wrap leading-6">{quote.sourceText}</p>
        </details>
      ) : null}

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offerte verwijderen?</DialogTitle>
            <DialogDescription>
              De offerte verdwijnt uit de lijst. De actie blijft in het auditlog staan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveOpen(false)}>
              Annuleren
            </Button>
            <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void onDelete()}>
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function previewLines(lines: LineDraft[]) {
  try {
    return toDraftLines(lines).map((line, index) => ({
      id: `preview-${index}`,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceCents: line.unitPriceCents,
    }));
  } catch {
    return null;
  }
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
