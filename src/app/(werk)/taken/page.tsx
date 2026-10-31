"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyNote, ErrorNote, LoadingNote } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import type { Appointment, Task } from "@/lib/domain/types";

interface QuoteRef {
  id: string;
  number: string;
  customerName: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [quotes, setQuotes] = useState<QuoteRef[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    void api<{ tasks: Task[]; appointments: Appointment[]; quotes: QuoteRef[] }>("/api/taken")
      .then((data) => {
        setTasks(data.tasks);
        setAppointments(data.appointments);
        setQuotes(data.quotes);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    load();
  }, []);

  async function addTask() {
    setError(null);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title, detail, dueDate: dueDate || null, quoteId: quoteId || null }),
      });
      setTitle("");
      setDetail("");
      setDueDate("");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan mislukt.");
    }
  }

  async function toggle(task: Task) {
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: !task.done }) });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Bijwerken mislukt.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Taken</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Herinneringen op je bureau</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Een herinnering is intern. Een afspraak bij een klant loopt via de permissie en staat ook in{" "}
          <Link href="/boekhouding" className="underline">Boekhouding</Link>.
        </p>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      <form
        className="rounded-2xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void addTask();
        }}
      >
        <Label htmlFor="title">Titel</Label>
        <Input id="title" className="mt-1.5 h-10" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Label htmlFor="detail" className="mt-3">Toelichting</Label>
        <Textarea id="detail" className="mt-1.5" value={detail} onChange={(event) => setDetail(event.target.value)} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="due">Datum</Label>
            <Input id="due" type="date" className="mt-1.5 h-10" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="quote">Offerte</Label>
            <select id="quote" className="mt-1.5 h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm" value={quoteId} onChange={(event) => setQuoteId(event.target.value)}>
              <option value="">Geen</option>
              {quotes.map((quote) => (
                <option key={quote.id} value={quote.id}>{quote.number} · {quote.customerName}</option>
              ))}
            </select>
          </div>
        </div>
        <Button type="button" className="mt-3 h-10" disabled={!title.trim()} onClick={() => void addTask()}>Herinnering bewaren</Button>
      </form>
      {tasks === null && !error ? <LoadingNote label="Taken laden…" /> : null}
      {tasks && tasks.length === 0 ? <EmptyNote title="Geen herinneringen" text="Maak er een bij een conceptofferte, of hierboven." /> : null}
      <ul className="grid gap-2">
        {(tasks ?? []).map((task) => (
          <li key={task.id} className="rounded-xl border border-border bg-card px-4 py-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={task.done} onChange={() => void toggle(task)} />
              <span>
                <span className={task.done ? "text-muted-foreground line-through" : "font-medium"}>{task.title}</span>
                {task.example ? <span className="ml-2 text-xs text-muted-foreground">voorbeeld</span> : null}
                <span className="mt-1 block text-muted-foreground">{task.detail}</span>
                {task.quoteId ? (
                  <Link href={`/offertes/${task.quoteId}`} className="mt-1 inline-block underline">Bijbehorende offerte</Link>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <section>
        <h2 className="font-heading text-2xl">Ingeplande afspraken</h2>
        {appointments.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nog geen gesimuleerde afspraken.</p> : null}
        <ul className="mt-3 grid gap-2">
          {appointments.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <p className="font-medium">{item.title}</p>
              <p className="text-muted-foreground">{item.customerName} · {item.when}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
