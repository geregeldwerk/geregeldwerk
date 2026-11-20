"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandCheck } from "@/components/brand-check";
import { EMPLOYEE_BANDS, INDUSTRIES, WAITLIST_PLANS } from "@/lib/waitlist/schema";

type Done = { status: "created" | "exists"; message: string };

const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-2.5 text-sm aria-invalid:border-destructive";

const FIELD_BY_MESSAGE: Record<string, string> = {
  "Vul je naam in.": "waitlist-name",
  "Vul een geldig e-mailadres in.": "waitlist-email",
  "Kies een branche.": "waitlist-industry",
  "Kies het aantal medewerkers.": "waitlist-employees",
  "Kies Nederland of België.": "waitlist-country",
  "Zonder toestemming kunnen we je niet inschrijven.": "waitlist-consent",
};

function messagesFor(field: string, issues: string[]) {
  return issues.filter((issue) => FIELD_BY_MESSAGE[issue] === field);
}

export function WaitlistForm() {
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (issues.length === 0) return;
    const field = FIELD_BY_MESSAGE[issues[0]];
    document.getElementById(field ?? "wachtlijst-fout")?.focus();
  }, [issues]);

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
    <form className="grid gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6" onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={busy}>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="waitlist-name" label="Naam" issues={issues}>
          <input id="waitlist-name" name="name" required autoComplete="name" className={inputClass} {...invalidProps("waitlist-name", issues)} />
        </Field>
        <Field id="waitlist-email" label="E-mail" issues={issues}>
          <input id="waitlist-email" name="email" type="email" required autoComplete="email" className={inputClass} {...invalidProps("waitlist-email", issues)} />
        </Field>
        <label className="text-sm" htmlFor="waitlist-company">
          Bedrijfsnaam
          <input id="waitlist-company" name="company" autoComplete="organization" className={inputClass} />
        </label>
        <Field id="waitlist-industry" label="Branche" issues={issues}>
          <select id="waitlist-industry" name="industry" required className={inputClass} defaultValue="" {...invalidProps("waitlist-industry", issues)}>
            <option value="" disabled>Kies een branche</option>
            {INDUSTRIES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field id="waitlist-employees" label="Aantal medewerkers" issues={issues}>
          <select id="waitlist-employees" name="employees" required className={inputClass} defaultValue="" {...invalidProps("waitlist-employees", issues)}>
            <option value="" disabled>Kies</option>
            {EMPLOYEE_BANDS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
        <label className="text-sm" htmlFor="waitlist-country">
          Land
          <select id="waitlist-country" name="country" required className={inputClass} defaultValue="NL" {...invalidProps("waitlist-country", issues)}>
            <option value="NL">Nederland</option>
            <option value="BE">België</option>
          </select>
          <FieldMessage id="waitlist-country" issues={issues} />
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
      <div>
        <label className="flex items-start gap-2 text-sm" htmlFor="waitlist-consent">
          <input id="waitlist-consent" name="consent" type="checkbox" required className="mt-1 size-4" {...invalidProps("waitlist-consent", issues)} />
          <span>
            Ik ga akkoord dat GeregeldWerk mijn gegevens bewaart om mij te informeren over de lancering.{" "}
            <Link href="/privacy" className="underline">Privacy</Link>
          </span>
        </label>
        <FieldMessage id="waitlist-consent" issues={issues} />
      </div>
      {error ? (
        <div id="wachtlijst-fout" tabIndex={-1} role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm outline-none">
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
      <button type="submit" disabled={busy} className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">
        {busy ? "Bezig…" : "Zet me op de wachtlijst"}
      </button>
    </form>
  );
}

function invalidProps(field: string, issues: string[]) {
  const messages = messagesFor(field, issues);
  if (messages.length === 0) return {};
  return {
    "aria-invalid": true as const,
    "aria-describedby": `${field}-fout`,
  };
}

function FieldMessage({ id, issues }: { id: string; issues: string[] }) {
  const messages = messagesFor(id, issues);
  if (messages.length === 0) return null;
  return (
    <p id={`${id}-fout`} className="mt-1 text-xs leading-5 text-destructive">
      {messages.join(" ")}
    </p>
  );
}

function Field({
  id,
  label,
  issues,
  children,
}: {
  id: string;
  label: string;
  issues: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm" htmlFor={id}>
      {label}
      {children}
      <FieldMessage id={id} issues={issues} />
    </label>
  );
}
