"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ErrorNote, LoadingNote } from "@/components/feedback";
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
import { api } from "@/lib/client/api";
import { downloadJson } from "@/lib/client/download";
import type { TimelineEvent } from "@/lib/domain/customers";
import { formatEuro } from "@/lib/domain/money";
import {
  CUSTOMER_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
  PIPELINE_LABEL,
  PIPELINE_STATUSES,
  type Appointment,
  type Customer,
  type CustomerNote,
  type CustomerType,
  type Invoice,
  type PipelineStatus,
  type Quote,
  type Task,
} from "@/lib/domain/types";

interface CustomerPayload {
  customer: Customer;
  notes: CustomerNote[];
  quotes: Quote[];
  invoices: Invoice[];
  tasks: Task[];
  appointments: Appointment[];
  timeline: TimelineEvent[];
}

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  offerte: "Offerte",
  factuur: "Factuur",
  betaling: "Betaling",
  notitie: "Notitie",
  taak: "Taak",
  afspraak: "Afspraak",
};

const selectClass = "h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm";

export function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = useState<CustomerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteQuoteId, setNoteQuoteId] = useState("");
  const [noteInvoiceId, setNoteInvoiceId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetail, setTaskDetail] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [tags, setTags] = useState("");

  function load() {
    void api<CustomerPayload>(`/api/klanten/${params.id}`)
      .then((data) => {
        setPayload(data);
        setTags(data.customer.tags.join(", "));
        setError(null);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    let cancelled = false;
    void api<CustomerPayload>(`/api/klanten/${params.id}`)
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setTags(data.customer.tags.join(", "));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Laden mislukt.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function patchCustomer(partial: Partial<Customer>) {
    if (!payload) return;
    setPayload({ ...payload, customer: { ...payload.customer, ...partial } });
  }

  async function save() {
    if (!payload) return;
    setBusy("opslaan");
    setError(null);
    try {
      const { customer } = payload;
      const result = await api<{ customer: Customer }>(`/api/klanten/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: customer.name,
          type: customer.type,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          country: customer.country,
          vatOrEnterpriseNumber: customer.vatOrEnterpriseNumber,
          source: customer.source,
          pipelineStatus: customer.pipelineStatus,
          lossReason: customer.lossReason,
          tags,
          retainUntil: customer.retainUntil,
        }),
      });
      setNotice("Klantkaart bewaard. Een volgende offerte kan de pijplijn weer mee laten lopen.");
      setPayload({ ...payload, customer: result.customer });
      setTags(result.customer.tags.join(", "));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function addNote() {
    if (!payload) return;
    setBusy("notitie");
    setError(null);
    try {
      await api(`/api/klanten/${payload.customer.id}/notities`, {
        method: "POST",
        body: JSON.stringify({
          text: note,
          quoteId: noteQuoteId || null,
          invoiceId: noteInvoiceId || null,
        }),
      });
      setNote("");
      setNoteQuoteId("");
      setNoteInvoiceId("");
      setNotice("Notitie toegevoegd.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notitie mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function makeQuote() {
    if (!payload) return;
    setBusy("offerte");
    setError(null);
    try {
      const result = await api<{ quote: Quote }>(`/api/klanten/${payload.customer.id}/offerte`, { method: "POST" });
      router.push(`/offertes/${result.quote.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Offerte mislukt.");
      setBusy(null);
    }
  }

  async function makeTask() {
    if (!payload) return;
    setBusy("taak");
    setError(null);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle,
          detail: taskDetail,
          dueDate: taskDue || null,
          quoteId: null,
          customerId: payload.customer.id,
        }),
      });
      setTaskTitle("");
      setTaskDetail("");
      setTaskDue("");
      setNotice("Taak gezet.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Taak mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function exportCustomer() {
    if (!payload) return;
    setBusy("export");
    setError(null);
    try {
      const data = await api<unknown>(`/api/klanten/${payload.customer.id}/export`);
      downloadJson(`klant-${payload.customer.id}.json`, data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!payload) return;
    setBusy("verwijderen");
    setError(null);
    try {
      const result = await api<{ message: string }>(`/api/klanten/${payload.customer.id}`, { method: "DELETE" });
      router.push(`/klanten?melding=${encodeURIComponent(result.message)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Verwijderen mislukt.");
      setBusy(null);
      setRemoveOpen(false);
    }
  }

  if (error && !payload) return <ErrorNote message={error} />;
  if (!payload) return <LoadingNote label="Klant laden…" />;

  const { customer, timeline, quotes, invoices } = payload;
  const invoiceCount = invoices.length;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/klanten" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Alle klanten
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">{CUSTOMER_TYPE_LABEL[customer.type]}</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">{customer.name || "Naam ontbreekt"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {PIPELINE_LABEL[customer.pipelineStatus]}
            {customer.example ? " · voorbeeld" : ""}
            {customer.source ? ` · bron ${customer.source}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10" disabled={busy !== null} onClick={() => void makeQuote()}>
            Offerte maken
          </Button>
          <Button type="button" variant="outline" className="h-10" disabled={busy !== null} onClick={() => void exportCustomer()}>
            Exporteer JSON
          </Button>
          <Button type="button" variant="ghost" className="h-10" onClick={() => setRemoveOpen(true)}>
            Verwijderen
          </Button>
        </div>
      </div>

      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          className="rounded-2xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2 className="font-heading text-xl">Gegevens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Een verstuurde, geaccepteerde of afgewezen offerte zet de pijplijn mee. Je kunt de stap daarna zelf aanpassen.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Naam" id="name">
              <Input id="name" className="h-10" autoComplete="off" value={customer.name} onChange={(event) => patchCustomer({ name: event.target.value })} />
            </Field>
            <Field label="Type" id="type">
              <select id="type" className={selectClass} value={customer.type} onChange={(event) => patchCustomer({ type: event.target.value as CustomerType })}>
                <option value="particulier">Particulier</option>
                <option value="zakelijk">Zakelijk</option>
              </select>
            </Field>
            <Field label="Telefoon" id="phone">
              <Input id="phone" className="h-10" autoComplete="off" value={customer.phone} onChange={(event) => patchCustomer({ phone: event.target.value })} />
            </Field>
            <Field label="E-mail" id="email">
              <Input id="email" className="h-10" autoComplete="off" value={customer.email} onChange={(event) => patchCustomer({ email: event.target.value })} />
            </Field>
            <Field label="Adres" id="address">
              <Input id="address" className="h-10" autoComplete="off" value={customer.address} onChange={(event) => patchCustomer({ address: event.target.value })} />
            </Field>
            <Field label="Land" id="country">
              <select id="country" className={selectClass} value={customer.country} onChange={(event) => patchCustomer({ country: event.target.value === "BE" ? "BE" : "NL" })}>
                <option value="NL">Nederland</option>
                <option value="BE">België</option>
              </select>
            </Field>
            <Field label="Btw- of ondernemingsnummer" id="vat">
              <Input id="vat" className="h-10" autoComplete="off" value={customer.vatOrEnterpriseNumber} onChange={(event) => patchCustomer({ vatOrEnterpriseNumber: event.target.value })} />
            </Field>
            <Field label="Bron" id="source">
              <Input id="source" className="h-10" value={customer.source} onChange={(event) => patchCustomer({ source: event.target.value })} />
            </Field>
            <Field label="Pijplijn" id="pipeline">
              <select id="pipeline" className={selectClass} value={customer.pipelineStatus} onChange={(event) => patchCustomer({ pipelineStatus: event.target.value as PipelineStatus })}>
                {PIPELINE_STATUSES.map((status) => (
                  <option key={status} value={status}>{PIPELINE_LABEL[status]}</option>
                ))}
              </select>
            </Field>
            <Field label="Labels" id="tags">
              <Input id="tags" className="h-10" value={tags} onChange={(event) => setTags(event.target.value)} />
            </Field>
            <Field label="Bewaar tot" id="retain">
              <Input id="retain" type="date" className="h-10" value={customer.retainUntil ?? ""} onChange={(event) => patchCustomer({ retainUntil: event.target.value || null })} />
            </Field>
            {customer.pipelineStatus === "verloren" ? (
              <Field label="Verliesreden" id="loss">
                <Input id="loss" className="h-10" value={customer.lossReason} onChange={(event) => patchCustomer({ lossReason: event.target.value })} />
              </Field>
            ) : null}
          </div>
          <Button type="submit" className="mt-3 h-10" disabled={busy !== null || !customer.name.trim()}>
            {busy === "opslaan" ? "Opslaan…" : "Gegevens bewaren"}
          </Button>
        </form>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-heading text-xl">Tijdlijn</h2>
          {timeline.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nog geen offertes, facturen, notities, taken of afspraken.</p> : null}
          <ol className="mt-3 grid gap-3">
            {timeline.map((event) => (
              <li key={event.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-xs text-muted-foreground">{KIND_LABEL[event.kind]} · {formatWhen(event.at)}</p>
                {event.href ? (
                  <Link href={event.href} className="font-medium underline-offset-4 hover:underline">{event.title}</Link>
                ) : (
                  <p className="font-medium">{event.title}</p>
                )}
                {event.detail ? <p className="text-sm text-muted-foreground">{event.detail}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Notitie</h2>
        <form
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void addNote();
          }}
        >
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Wat wil je onthouden?" aria-label="Notitie" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Offerte, optioneel" id="note-quote">
              <select id="note-quote" className={selectClass} value={noteQuoteId} onChange={(event) => setNoteQuoteId(event.target.value)}>
                <option value="">Geen</option>
                {quotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>{quote.number}</option>
                ))}
              </select>
            </Field>
            <Field label="Factuur, optioneel" id="note-invoice">
              <select id="note-invoice" className={selectClass} value={noteInvoiceId} onChange={(event) => setNoteInvoiceId(event.target.value)}>
                <option value="">Geen</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>{invoice.number}</option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit" variant="outline" className="h-10 sm:w-fit" disabled={busy !== null || !note.trim()}>
            Notitie toevoegen
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-xl">Taak</h2>
        <form
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void makeTask();
          }}
        >
          <Field label="Titel" id="task-title">
            <Input id="task-title" className="h-10" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
          </Field>
          <Field label="Toelichting" id="task-detail">
            <Textarea id="task-detail" value={taskDetail} onChange={(event) => setTaskDetail(event.target.value)} />
          </Field>
          <Field label="Datum" id="task-due">
            <Input id="task-due" type="date" className="h-10 sm:max-w-xs" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} />
          </Field>
          <Button type="submit" variant="outline" className="h-10 sm:w-fit" disabled={busy !== null || !taskTitle.trim()}>
            Taak zetten
          </Button>
        </form>
      </section>

      {invoices.length > 0 ? (
        <section>
          <h2 className="font-heading text-xl">Facturen</h2>
          <ul className="mt-3 grid gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link href={`/facturen/${invoice.id}`} className="block rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40">
                  <span className="font-medium">{invoice.number}</span>
                  <span className="mt-1 block text-muted-foreground">
                    {formatEuro(invoice.totalCents)} · {PAYMENT_STATUS_LABEL[invoice.paymentStatus ?? "open"]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Klantkaart verwijderen</DialogTitle>
            <DialogDescription>
              {invoiceCount > 0
                ? "De kaart verdwijnt. Facturen blijven bewaard. De klantgegevens op die facturen worden niet gewist."
                : "De kaart verdwijnt. Er staan geen facturen op deze klant."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveOpen(false)}>Annuleren</Button>
            <Button type="button" disabled={busy !== null} onClick={() => void remove()}>
              {busy === "verwijderen" ? "Verwijderen…" : "Verwijder klantkaart"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatWhen(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
