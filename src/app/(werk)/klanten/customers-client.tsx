"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyNote, ErrorNote, LoadingNote } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import {
  CUSTOMER_TYPE_LABEL,
  PIPELINE_LABEL,
  PIPELINE_STATUSES,
  type Customer,
  type CustomerType,
  type PipelineStatus,
} from "@/lib/domain/types";

const selectClass = "h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm";

export function CustomersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pipelineView = searchParams.get("weergave") === "pijplijn";
  const notice = searchParams.get("melding");
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<PipelineStatus | "alles">("alles");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "particulier" as CustomerType,
    phone: "",
    email: "",
    address: "",
    country: "NL" as "NL" | "BE",
    vatOrEnterpriseNumber: "",
    source: "",
    pipelineStatus: "lead" as PipelineStatus,
    lossReason: "",
    tags: "",
  });

  function load() {
    void api<{ customers: Customer[] }>("/api/klanten")
      .then((data) => {
        setCustomers(data.customers);
        setError(null);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    load();
  }, []);

  const needle = query.trim().toLocaleLowerCase("nl-NL");
  const visible = (customers ?? []).filter((customer) => {
    const haystack = `${customer.name} ${customer.email} ${customer.phone} ${customer.address} ${customer.source} ${customer.tags.join(" ")}`.toLocaleLowerCase(
      "nl-NL",
    );
    const matchesQuery = haystack.includes(needle);
    const matchesStep = pipelineView || step === "alles" || customer.pipelineStatus === step;
    return matchesQuery && matchesStep;
  });

  async function createCustomer() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ customer: Customer }>("/api/klanten", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          tags: form.tags,
          retainUntil: null,
        }),
      });
      setCreating(false);
      setForm({
        name: "",
        type: "particulier",
        phone: "",
        email: "",
        address: "",
        country: "NL",
        vatOrEnterpriseNumber: "",
        source: "",
        pipelineStatus: "lead",
        lossReason: "",
        tags: "",
      });
      router.push(`/klanten/${result.customer.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan mislukt.");
      setBusy(false);
    }
  }

  function openView(next: "lijst" | "pijplijn") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("melding");
    if (next === "pijplijn") params.set("weergave", "pijplijn");
    else params.delete("weergave");
    const queryString = params.toString();
    router.push(queryString ? `/klanten?${queryString}` : "/klanten");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Klanten</p>
          <h1 className="mt-2 font-heading text-4xl tracking-tight">Klanten en leads</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Eén kaart per klant. Offertes en facturen houden hun eigen klantgegevens, ook als je de kaart later verwijdert.
          </p>
        </div>
        <Button type="button" className="h-10 sm:w-fit" onClick={() => setCreating((open) => !open)}>
          {creating ? "Formulier sluiten" : "Nieuwe klant of lead"}
        </Button>
      </div>

      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      {error ? <ErrorNote message={error} onRetry={load} /> : null}

      {creating ? (
        <form
          className="rounded-2xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createCustomer();
          }}
        >
          <h2 className="font-heading text-xl">Nieuwe klant of lead</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Naam" id="new-name">
              <Input id="new-name" className="h-10" autoComplete="off" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Type" id="new-type">
              <select id="new-type" className={selectClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CustomerType })}>
                <option value="particulier">Particulier</option>
                <option value="zakelijk">Zakelijk</option>
              </select>
            </Field>
            <Field label="Telefoon" id="new-phone">
              <Input id="new-phone" className="h-10" autoComplete="off" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label="E-mail" id="new-email">
              <Input id="new-email" className="h-10" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Adres" id="new-address">
              <Input id="new-address" className="h-10" autoComplete="off" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            <Field label="Land" id="new-country">
              <select id="new-country" className={selectClass} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value === "BE" ? "BE" : "NL" })}>
                <option value="NL">Nederland</option>
                <option value="BE">België</option>
              </select>
            </Field>
            <Field label="Btw- of ondernemingsnummer" id="new-vat">
              <Input id="new-vat" className="h-10" autoComplete="off" value={form.vatOrEnterpriseNumber} onChange={(event) => setForm({ ...form, vatOrEnterpriseNumber: event.target.value })} />
            </Field>
            <Field label="Bron" id="new-source">
              <Input id="new-source" className="h-10" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Bijvoorbeeld telefoon" />
            </Field>
            <Field label="Pijplijn" id="new-pipeline">
              <select id="new-pipeline" className={selectClass} value={form.pipelineStatus} onChange={(event) => setForm({ ...form, pipelineStatus: event.target.value as PipelineStatus })}>
                {PIPELINE_STATUSES.map((status) => (
                  <option key={status} value={status}>{PIPELINE_LABEL[status]}</option>
                ))}
              </select>
            </Field>
            <Field label="Labels, gescheiden door komma's" id="new-tags">
              <Input id="new-tags" className="h-10" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
            </Field>
            {form.pipelineStatus === "verloren" ? (
              <Field label="Verliesreden" id="new-loss">
                <Input id="new-loss" className="h-10" value={form.lossReason} onChange={(event) => setForm({ ...form, lossReason: event.target.value })} />
              </Field>
            ) : null}
          </div>
          <Button type="submit" className="mt-3 h-10" disabled={busy || !form.name.trim()}>
            {busy ? "Opslaan…" : "Klant of lead bewaren"}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op naam, e-mail, telefoon of label"
          aria-label="Zoek klanten"
          className="h-10 sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Weergave">
          <FilterButton active={!pipelineView} onClick={() => openView("lijst")}>Lijst</FilterButton>
          <FilterButton active={pipelineView} onClick={() => openView("pijplijn")}>Pijplijn</FilterButton>
        </div>
      </div>

      {!pipelineView ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter op pijplijnstap">
          <FilterButton active={step === "alles"} onClick={() => setStep("alles")}>Alles</FilterButton>
          {PIPELINE_STATUSES.map((status) => (
            <FilterButton key={status} active={step === status} onClick={() => setStep(status)}>
              {PIPELINE_LABEL[status]}
            </FilterButton>
          ))}
        </div>
      ) : null}

      {customers === null && !error ? <LoadingNote label="Klanten laden…" /> : null}
      {customers && visible.length === 0 ? (
        <EmptyNote title="Geen klanten in deze selectie" text="Maak een klant of lead, of kies een andere stap." />
      ) : null}

      {pipelineView ? (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
          {PIPELINE_STATUSES.map((status) => {
            const cards = visible.filter((customer) => customer.pipelineStatus === status);
            return (
              <section key={status} className="w-[17rem] shrink-0 snap-start rounded-2xl border border-border bg-muted/40 p-3" aria-label={PIPELINE_LABEL[status]}>
                <h2 className="px-1 font-heading text-xl">{PIPELINE_LABEL[status]}</h2>
                <p className="px-1 text-xs text-muted-foreground">{cards.length}</p>
                <ul className="mt-3 grid gap-2">
                  {cards.length === 0 ? <li className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">Geen klanten</li> : null}
                  {cards.map((customer) => (
                    <li key={customer.id}>
                      <CustomerCard customer={customer} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="grid gap-3">
          {visible.map((customer) => (
            <li key={customer.id}>
              <CustomerCard customer={customer} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <Link href={`/klanten/${customer.id}`} className="block rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{customer.name || "Naam ontbreekt"}</span>
        <PipelineBadge status={customer.pipelineStatus} />
        {customer.example ? <span className="text-xs text-muted-foreground">voorbeeld</span> : null}
      </span>
      <span className="mt-1 block text-muted-foreground">
        {CUSTOMER_TYPE_LABEL[customer.type]}
        {customer.email ? ` · ${customer.email}` : ""}
        {customer.phone ? ` · ${customer.phone}` : ""}
      </span>
    </Link>
  );
}

function PipelineBadge({ status }: { status: PipelineStatus }) {
  const className =
    status === "gewonnen"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "verloren"
        ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
        : status === "offerte_verstuurd"
          ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
          : "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>{PIPELINE_LABEL[status]}</span>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 rounded-full px-3 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
    >
      {children}
    </button>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
