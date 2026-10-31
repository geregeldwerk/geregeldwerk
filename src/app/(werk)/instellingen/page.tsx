"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorNote, LoadingNote } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import type { CompanySettings } from "@/lib/domain/types";
import { vatPercentsForCountry } from "@/lib/peppol/spec";
import { settingsLookPlaceholder } from "@/lib/storage/seed";

export default function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [provider, setProvider] = useState("mock");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<{ settings: CompanySettings }>("/api/settings"),
      api<{ provider: string; warning: string | null }>("/api/health"),
    ])
      .then(([settingsData, health]) => {
        setSettings(settingsData.settings);
        setProvider(health.provider);
        setWarning(health.warning);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }, []);

  function patch<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ settings: CompanySettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(result.settings);
      setNotice("Bedrijfsgegevens opgeslagen. Permissies wijzig je apart, met goedkeuring.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !settings) return <ErrorNote message={error} />;
  if (!settings) return <LoadingNote label="Instellingen laden…" />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Instellingen</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Jouw bedrijfsgegevens</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Dit zijn placeholders voor op de offerte en de e-factuur. Ze komen op de PDF, de afdruk en de Peppol-UBL.{" "}
          <Link href="/permissies" className="underline">Permissies</Link> verander je niet hier: dat voorstel moet je expliciet goedkeuren.
        </p>
      </div>
      {settingsLookPlaceholder(settings) ? (
        <p className="rounded-xl border border-warning/40 bg-warning-bg px-4 py-3 text-sm">
          KvK en btw-nummer zijn nog fictief. Vul je eigen gegevens in voor je een offerte buiten deze demo gebruikt.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Assistent: {provider === "mock" ? "offline mock, geen API-sleutel" : provider}.
        {warning ? ` ${warning}` : ""}
      </p>
      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      {error ? <ErrorNote message={error} /> : null}
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="Bedrijfsnaam" id="companyName" value={settings.companyName} onChange={(value) => patch("companyName", value)} />
        <Field label="Contact" id="contactName" value={settings.contactName} onChange={(value) => patch("contactName", value)} />
        <Field label="Adres" id="address" value={settings.address} onChange={(value) => patch("address", value)} />
        <Field label="Postcode" id="postalCode" value={settings.postalCode} onChange={(value) => patch("postalCode", value)} />
        <Field label="Plaats" id="city" value={settings.city} onChange={(value) => patch("city", value)} />
        <Field label="Telefoon" id="phone" value={settings.phone} onChange={(value) => patch("phone", value)} />
        <Field label="E-mail" id="email" value={settings.email} onChange={(value) => patch("email", value)} />
        <div>
          <Label htmlFor="country">Land</Label>
          <select
            id="country"
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            value={settings.country === "BE" ? "BE" : "NL"}
            onChange={(event) => {
              const country = event.target.value === "BE" ? "BE" : "NL";
              const allowed = vatPercentsForCountry(country);
              const current = Math.round(settings.defaultVatRate * 100);
              patch("country", country);
              if (!allowed.includes(current)) patch("defaultVatRate", 0.21);
            }}
          >
            <option value="NL">Nederland</option>
            <option value="BE">België</option>
          </select>
        </div>
        <Field label="KvK" id="kvk" value={settings.kvk} onChange={(value) => patch("kvk", value)} />
        {settings.country === "BE" ? (
          <Field label="Ondernemingsnummer" id="enterpriseNumber" value={settings.enterpriseNumber ?? ""} onChange={(value) => patch("enterpriseNumber", value)} />
        ) : null}
        <Field label="Btw" id="btw" value={settings.btw} onChange={(value) => patch("btw", value)} />
        <Field label="IBAN" id="iban" value={settings.iban} onChange={(value) => patch("iban", value)} />
        <div>
          <Label htmlFor="validity">Geldigheid in dagen</Label>
          <Input id="validity" className="mt-1.5 h-10" type="number" min={1} max={365} value={settings.quoteValidityDays} onChange={(event) => patch("quoteValidityDays", Number(event.target.value))} />
        </div>
        <div>
          <Label htmlFor="vat">Standaard btw</Label>
          <select id="vat" className="mt-1.5 h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm" value={String(settings.defaultVatRate)} onChange={(event) => patch("defaultVatRate", Number(event.target.value))}>
            {vatPercentsForCountry(settings.country === "BE" ? "BE" : "NL").map((percent) => (
              <option key={percent} value={String(percent / 100)}>{percent}%</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="paymentTerm">Betaaltermijn factuur (dagen)</Label>
          <Input id="paymentTerm" className="mt-1.5 h-10" type="number" min={1} max={365} value={settings.paymentTermDays ?? 14} onChange={(event) => patch("paymentTermDays", Number(event.target.value))} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="footer">Tekst onderaan de offerte</Label>
          <Textarea id="footer" className="mt-1.5" value={settings.footerNote} onChange={(event) => patch("footerNote", event.target.value)} />
        </div>
        <Button type="button" className="h-10 sm:w-fit" disabled={busy} onClick={() => void save()}>{busy ? "Opslaan…" : "Bewaar gegevens"}</Button>
      </form>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="mt-1.5 h-10" autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
