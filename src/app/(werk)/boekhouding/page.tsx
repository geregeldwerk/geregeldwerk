"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorNote, LoadingNote } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import { formatEuro, parseEuroToCents } from "@/lib/domain/money";
import type { Appointment, Expense, Invoice } from "@/lib/domain/types";
import { SEND_STATUS_LABEL } from "@/lib/peppol/spec";

export default function BooksPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    void api<{ invoices: Invoice[]; expenses: Expense[]; appointments: Appointment[] }>("/api/boekhouding")
      .then((data) => {
        setInvoices(data.invoices);
        setExpenses(data.expenses);
        setAppointments(data.appointments);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    load();
  }, []);

  async function book() {
    const amountCents = parseEuroToCents(amount);
    if (!description.trim() || amountCents == null) {
      setError("Vul een omschrijving en een bedrag in, bijvoorbeeld 40,00.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ effect: string; reason: string }>("/api/acties", {
        method: "POST",
        body: JSON.stringify({
          actor: "mens",
          payload: { type: "bon_boeken", description, amountCents },
        }),
      });
      setNotice(result.effect === "uitgevoerd" ? "Bon gesimuleerd geboekt." : `${result.reason} Niets is geboekt tot je goedkeurt in Toezicht.`);
      setDescription("");
      setAmount("");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Boeken mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Boekhouding</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Facturen, bonnen, afspraken</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Facturen zijn Peppol-concepten op deze computer. Verzenden gaat alleen via de mock, niet naar een echt Access Point. Een bon onder het maximum wordt direct geboekt. Daarboven wacht hij op jouw goedkeuring.{" "}
          <Link className="underline" href="/taken">Herinneringen staan bij taken.</Link>
        </p>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      <form
        className="rounded-2xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void book();
        }}
      >
        <h2 className="font-heading text-xl">Bonnetje boeken</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="bon">Omschrijving</Label>
            <Input id="bon" className="mt-1.5 h-10" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Fictieve pakking" />
          </div>
          <div>
            <Label htmlFor="bedrag">Bedrag</Label>
            <Input id="bedrag" className="mt-1.5 h-10" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="40,00" />
          </div>
        </div>
        <Button type="button" className="mt-3 h-10" disabled={busy} onClick={() => void book()}>Boek via permissie</Button>
      </form>
      {invoices === null && !error ? <LoadingNote label="Boekhouding laden…" /> : null}
      <section>
        <h2 className="font-heading text-2xl">Facturen</h2>
        {invoices && invoices.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nog geen facturen. Maak er een vanaf een verstuurde offerte.</p> : null}
        <ul className="mt-3 grid gap-2">
          {(invoices ?? []).map((invoice) => (
            <li key={invoice.id}>
              <Link href={`/facturen/${invoice.id}`} className="block rounded-xl border border-border bg-card px-4 py-3 text-sm hover:border-primary/40">
                <p className="font-medium">{invoice.number} · {invoice.customerName}{invoice.example ? " · voorbeeld" : ""}</p>
                <p className="text-muted-foreground">
                  {formatEuro(invoice.totalCents)} incl. btw · {SEND_STATUS_LABEL[invoice.sendStatus ?? "niet_verstuurd"]}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-heading text-2xl">Bonnen</h2>
        <ul className="mt-3 grid gap-2">
          {expenses.map((expense) => (
            <li key={expense.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <p className="font-medium">{expense.description}{expense.example ? " · voorbeeld" : ""}</p>
              <p className="text-muted-foreground">{formatEuro(expense.amountCents)} · gesimuleerd</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-heading text-2xl">Afspraken</h2>
        {appointments.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nog geen afspraken. Plan er een op een offerte.</p> : null}
        <ul className="mt-3 grid gap-2">
          {appointments.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground">{item.customerName} · {item.when} · gesimuleerd</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
