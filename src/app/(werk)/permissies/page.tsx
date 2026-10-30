"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ErrorNote, LoadingNote } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import { centsToInput, parseEuroToCents } from "@/lib/domain/money";
import type { PermissionMode, PermissionProposal, PermissionRule, PermissionsState } from "@/lib/domain/types";
import { ACTION_LABEL, MODE_LABEL } from "@/lib/oversight/permissions";

export default function PermissionsPage() {
  const [rules, setRules] = useState<PermissionRule[] | null>(null);
  const [proposals, setProposals] = useState<PermissionProposal[]>([]);
  const [hours, setHours] = useState<boolean | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function load() {
    void api<{ permissions: PermissionsState; proposals: PermissionProposal[]; withinBusinessHours: boolean }>("/api/permissies")
      .then((data) => {
        setRules(data.permissions.rules);
        setProposals(data.proposals);
        setHours(data.withinBusinessHours);
        setAmounts(
          Object.fromEntries(data.permissions.rules.map((rule) => [rule.actionType, centsToInput(rule.maxAmountCents)])),
        );
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    load();
  }, []);

  function update(actionType: string, patch: Partial<PermissionRule>) {
    setRules((current) => current?.map((rule) => (rule.actionType === actionType ? { ...rule, ...patch } : rule)) ?? null);
  }

  async function submit() {
    if (!rules) return;
    setBusy(true);
    setError(null);
    try {
      const next = rules.map((rule) => {
        const raw = amounts[rule.actionType]?.trim() ?? "";
        const maxAmountCents = raw ? parseEuroToCents(raw) : null;
        if (raw && maxAmountCents == null) throw new Error(`Maximum voor ${ACTION_LABEL[rule.actionType]} is geen bedrag.`);
        return { ...rule, maxAmountCents };
      });
      await api("/api/permissies", { method: "POST", body: JSON.stringify({ rules: next }) });
      setNotice("Voorstel ingediend. De oude regels blijven gelden tot je goedkeurt.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Indienen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "goedgekeurd" | "afgewezen") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/permissies/${id}`, {
        method: "POST",
        body: JSON.stringify({ decision, comment: comments[id] ?? "" }),
      });
      setNotice(decision === "goedgekeurd" ? "Permissies bijgewerkt." : "Voorstel afgewezen.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Besluit mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const open = proposals.filter((item) => item.status === "wacht_op_goedkeuring");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Permissies</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Eenmalig toestemming, daarna automatisch</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Per actie kies je altijd vragen, automatisch binnen grenzen, of uit. Een wijziging geldt pas nadat je die hier goedkeurt.
          {hours === null ? "" : hours ? " Het is nu binnen de standaard werktijd." : " Het is nu buiten de standaard werktijd."}{" "}
          <Link href="/toezicht" className="underline">Noodstop zit bij Toezicht.</Link>
        </p>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      {rules === null && !error ? <LoadingNote label="Permissies laden…" /> : null}
      {rules ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {rules.map((rule) => (
            <fieldset key={rule.actionType} className="rounded-2xl border border-border bg-card p-4">
              <legend className="px-1 font-heading text-xl">{ACTION_LABEL[rule.actionType]}</legend>
              <Label htmlFor={`${rule.actionType}-mode`}>Stand</Label>
              <select
                id={`${rule.actionType}-mode`}
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm sm:max-w-xs"
                value={rule.mode}
                onChange={(event) => update(rule.actionType, { mode: event.target.value as PermissionMode })}
              >
                {(Object.keys(MODE_LABEL) as PermissionMode[]).map((mode) => (
                  <option key={mode} value={mode}>{MODE_LABEL[mode]}</option>
                ))}
              </select>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`${rule.actionType}-max`}>Maximumbedrag, leeg = geen grens</Label>
                  <Input
                    id={`${rule.actionType}-max`}
                    className="mt-1.5 h-10"
                    inputMode="decimal"
                    placeholder="75,00"
                    value={amounts[rule.actionType] ?? ""}
                    onChange={(event) => setAmounts({ ...amounts, [rule.actionType]: event.target.value })}
                  />
                </div>
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rule.existingCustomersOnly} onChange={(event) => update(rule.actionType, { existingCustomersOnly: event.target.checked })} />
                    Alleen bestaande klanten
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rule.businessHoursOnly} onChange={(event) => update(rule.actionType, { businessHoursOnly: event.target.checked })} />
                    Alleen tijdens werktijd
                  </label>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-xs">
                <div>
                  <Label htmlFor={`${rule.actionType}-start`}>Van</Label>
                  <Input id={`${rule.actionType}-start`} className="mt-1.5 h-10" value={rule.businessStart} onChange={(event) => update(rule.actionType, { businessStart: event.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`${rule.actionType}-end`}>Tot</Label>
                  <Input id={`${rule.actionType}-end`} className="mt-1.5 h-10" value={rule.businessEnd} onChange={(event) => update(rule.actionType, { businessEnd: event.target.value })} />
                </div>
              </div>
            </fieldset>
          ))}
          <Button type="button" className="h-10 self-start" disabled={busy} onClick={() => void submit()}>Indienen ter goedkeuring</Button>
        </form>
      ) : null}
      <section>
        <h2 className="font-heading text-2xl">Open voorstellen</h2>
        {open.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Geen wijziging in afwachting.</p> : null}
        <ul className="mt-3 grid gap-3">
          {open.map((proposal) => (
            <li key={proposal.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p className="font-medium">{proposal.example ? "Voorbeeldvoorstel" : "Nieuw voorstel"}</p>
              <ul className="mt-2 space-y-1">
                {proposal.after.map((rule) => {
                  const previous = proposal.before.find((item) => item.actionType === rule.actionType);
                  if (!previous || JSON.stringify(previous) === JSON.stringify(rule)) return null;
                  return (
                    <li key={rule.actionType}>
                      {ACTION_LABEL[rule.actionType]}: {MODE_LABEL[previous.mode]} → {MODE_LABEL[rule.mode]}, maximum {previous.maxAmountCents ?? "geen"} → {rule.maxAmountCents ?? "geen"} cent
                    </li>
                  );
                })}
              </ul>
              <Label htmlFor={`pc-${proposal.id}`} className="mt-3">Opmerking</Label>
              <Input id={`pc-${proposal.id}`} className="mt-1.5 h-10" value={comments[proposal.id] ?? ""} onChange={(event) => setComments({ ...comments, [proposal.id]: event.target.value })} />
              <div className="mt-3 flex gap-2">
                <Button type="button" className="h-10" disabled={busy} onClick={() => void decide(proposal.id, "goedgekeurd")}>Goedkeuren</Button>
                <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void decide(proposal.id, "afgewezen")}>Afwijzen</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
