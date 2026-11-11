"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandCheck } from "@/components/brand-check";
import { EMPLOYEE_BANDS, INDUSTRIES, WAITLIST_PLANS } from "@/lib/waitlist/schema";

type Done = { status: "created" | "exists"; message: string };

const inputClass = "mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function WaitlistForm() {
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssues([]);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      company: String(form.get("company") ?? ""),
      industry: String(form.get("industry") ?? ""),
      employees: String(form.get("employees") ?? ""),
      country: String(form.get("country") ?? ""),
      plan: String(form.get("plan") ?? ""),
      timePain: String(form.get("timePain") ?? ""),
      consent: form.get("consent") === "on",
      website: String(form.get("website") ?? ""),
    };
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { status?: "created" | "exists"; message?: string; error?: string; issues?: string[] };
      if (!response.ok || !body.status || !body.message) {
        setError(body.error ?? "Inschrijven lukt nu niet.");
        setIssues(body.issues ?? []);
        return;
      }
      setDone({ status: body.status, message: body.message });
    } catch {
      setError("Inschrijven lukt nu niet.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-primary/40 bg-card px-5 py-8" role="status">
        <BrandCheck className="size-8" />
        <h3 className="mt-4 font-heading text-2xl">{done.status === "exists" ? "Je staat er al op" : "Je staat op de lijst"}</h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{done.message}</p>
      </div>
    );
  }

  return (
    <form className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6" onSubmit={(event) => void onSubmit(event)} noValidate>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm" htmlFor="waitlist-name">
          Naam
          <input id="waitlist-name" name="name" required autoComplete="name" className={inputClass} />
        </label>
        <label className="text-sm" htmlFor="waitlist-email">
          E-mail
          <input id="waitlist-email" name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="text-sm" htmlFor="waitlist-company">
          Bedrijfsnaam
          <input id="waitlist-company" name="company" autoComplete="organization" className={inputClass} />
        </label>
        <label className="text-sm" htmlFor="waitlist-industry">
          Branche
          <select id="waitlist-industry" name="industry" required className={inputClass} defaultValue="">
            <option value="" disabled>Kies een branche</option>
            {INDUSTRIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm" htmlFor="waitlist-employees">
          Aantal medewerkers
          <select id="waitlist-employees" name="employees" required className={inputClass} defaultValue="">
            <option value="" disabled>Kies</option>
            {EMPLOYEE_BANDS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm" htmlFor="waitlist-country">
          Land
          <select id="waitlist-country" name="country" required className={inputClass} defaultValue="NL">
            <option value="NL">Nederland</option>
            <option value="BE">België</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2" htmlFor="waitlist-plan">
          Interessantste pakket
          <select id="waitlist-plan" name="plan" className={inputClass} defaultValue="">
            <option value="">Nog geen voorkeur</option>
            {WAITLIST_PLANS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-sm" htmlFor="waitlist-time">
        Wat kost jou nu de meeste tijd bij offertes?
        <textarea id="waitlist-time" name="timePain" rows={4} className="mt-1.5 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm" />
      </label>
      <label className="flex items-start gap-2 text-sm" htmlFor="waitlist-consent">
        <input id="waitlist-consent" name="consent" type="checkbox" required className="mt-1" />
        <span>
          Ik ga akkoord dat GeregeldWerk mijn gegevens bewaart om mij te informeren over de lancering.{" "}
          <Link href="/privacy" className="underline">Privacy</Link>
        </span>
      </label>
      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p>{error}</p>
          {issues.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button type="submit" disabled={busy} className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy ? "Bezig…" : "Zet me op de wachtlijst"}
      </button>
    </form>
  );
}
