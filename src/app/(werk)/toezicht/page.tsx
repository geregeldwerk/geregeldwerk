"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ErrorNote, LoadingNote } from "@/components/feedback";
import { SwipeApproval } from "@/components/swipe-approval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client/api";
import { ACTION_LABEL } from "@/lib/oversight/permissions";
import type { ActionType, Approval, AuditEntry, AuditOutcome, PermissionProposal } from "@/lib/domain/types";

interface OversightPayload {
  emergencyStop: boolean;
  withinBusinessHours: boolean;
  pendingApprovals: Approval[];
  pendingPermissionChanges: PermissionProposal[];
  audit: AuditEntry[];
  counts: { pendingApprovals: number; pendingPermissionChanges: number; audit: number; errors: number; recentAi: number };
}

const OUTCOMES: Array<AuditOutcome | "alles"> = ["alles", "uitgevoerd", "wachtrij", "geweigerd", "goedgekeurd", "afgewezen", "fout"];

export default function OversightPage() {
  const [data, setData] = useState<OversightPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AuditOutcome | "alles">("alles");
  const [actor, setActor] = useState<"alles" | "ai" | "mens">("alles");
  const [action, setAction] = useState<string>("alles");
  const [query, setQuery] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function load() {
    void api<OversightPayload>("/api/toezicht")
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const rows = [...(data?.audit ?? [])].reverse();
    return rows.filter((entry) => {
      if (outcome !== "alles" && entry.outcome !== outcome) return false;
      if (actor !== "alles" && entry.actor.kind !== actor) return false;
      if (action !== "alles" && entry.action !== action) return false;
      const haystack = `${entry.summary} ${entry.action} ${entry.actor.label}`.toLocaleLowerCase("nl-NL");
      return haystack.includes(query.trim().toLocaleLowerCase("nl-NL"));
    });
  }, [data, outcome, actor, action, query]);

  const recentAi = [...(data?.audit ?? [])].reverse().filter((entry) => entry.actor.kind === "ai").slice(0, 6);
  const errors = [...(data?.audit ?? [])].reverse().filter((entry) => entry.outcome === "fout" || entry.error).slice(0, 6);
  const actions = Array.from(new Set((data?.audit ?? []).map((entry) => entry.action)));

  async function stop(paused: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      await api("/api/toezicht", { method: "POST", body: JSON.stringify({ paused }) });
      setNotice(paused ? "Noodstop aan." : "Noodstop uit.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Noodstop mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function simulate(amountCents: number) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ effect: string; reason: string }>("/api/acties", {
        method: "POST",
        body: JSON.stringify({
          actor: "ai",
          payload: { type: "bon_boeken", description: "Gesimuleerde bon van de assistent", amountCents },
        }),
      });
      setNotice(`${result.effect}: ${result.reason}`);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulatie mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "goedgekeurd" | "afgewezen") {
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ effect: string; reason: string }>(`/api/wachtrij/${id}`, {
        method: "POST",
        body: JSON.stringify({ decision, comment: comments[id] ?? "" }),
      });
      setNotice(result.reason);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Besluit mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Overzicht / Toezicht</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Wat er gebeurde, en wat nog wacht</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Binnen een actieve permissie gebeurt het meteen en komt het in het log. Daarbuiten blijft het hier staan tot jij goedkeurt of afwijst.
        </p>
      </div>
      {error ? <ErrorNote message={error} onRetry={load} /> : null}
      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      {data === null && !error ? <LoadingNote label="Toezicht laden…" /> : null}
      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            <Stat label="Wachtrij" value={String(data.counts.pendingApprovals)} />
            <Stat label="Permissievoorstellen" value={String(data.counts.pendingPermissionChanges)} />
            <Stat label="Fouten" value={String(data.counts.errors)} />
            <Stat label="Logregels" value={String(data.counts.audit)} />
          </section>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-heading text-2xl">Noodstop</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Zet alle automatische permissies in één keer stil. Regels zelf veranderen niet.{" "}
              {data.withinBusinessHours ? "Het is nu binnen de standaard werktijd." : "Het is nu buiten de standaard werktijd."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="destructive" className="h-10" disabled={busy || data.emergencyStop} onClick={() => void stop(true)}>
                Pauzeer automatische acties
              </Button>
              <Button type="button" variant="outline" className="h-10" disabled={busy || !data.emergencyStop} onClick={() => void stop(false)}>
                Hervat
              </Button>
              <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void simulate(4000)}>
                Simuleer AI-bon € 40
              </Button>
              <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => void simulate(12000)}>
                Simuleer AI-bon € 120
              </Button>
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-semibold tracking-tight">Wacht op jouw tik</h2>
            <p className="mt-1 text-sm text-muted-foreground">Veeg naar rechts om goed te keuren, naar links om af te wijzen. Of tik de knop.</p>
            {data.pendingApprovals.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Niets open. Lekker rustig.</p> : null}
            <ul className="mt-3 grid gap-3">
              {data.pendingApprovals.map((item) => (
                <li key={item.id}>
                  <SwipeApproval
                    disabled={busy}
                    onApprove={() => void decide(item.id, "goedgekeurd")}
                    onReject={() => void decide(item.id, "afgewezen")}
                  >
                    <div className="rounded-3xl border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs tracking-wide text-muted-foreground uppercase">{ACTION_LABEL[item.actionType as ActionType] ?? item.actionType}</span>
                        {item.example ? <span className="text-xs">Voorbeeld</span> : null}
                        <span className="text-xs text-muted-foreground">{item.actor.label}</span>
                      </div>
                      <p className="mt-1 font-medium">{item.summary}</p>
                      <p className="text-sm text-muted-foreground">{item.reason}</p>
                      {item.lastError ? <p className="mt-1 text-sm text-destructive">{item.lastError}</p> : null}
                      <Label htmlFor={`comment-${item.id}`} className="mt-3">Opmerking, optioneel</Label>
                      <Input id={`comment-${item.id}`} className="mt-1.5 h-11" value={comments[item.id] ?? ""} onChange={(event) => setComments({ ...comments, [item.id]: event.target.value })} />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button type="button" className="h-12" disabled={busy} onClick={() => void decide(item.id, "goedgekeurd")}>Goedkeuren</Button>
                        <Button type="button" variant="outline" className="h-12" disabled={busy} onClick={() => void decide(item.id, "afgewezen")}>Afwijzen</Button>
                      </div>
                    </div>
                  </SwipeApproval>
                </li>
              ))}
            </ul>
            {data.pendingPermissionChanges.length > 0 ? (
              <p className="mt-3 text-sm">
                Er {data.pendingPermissionChanges.length === 1 ? "wacht een permissiewijziging" : "wachten permissiewijzigingen"}.{" "}
                <Link href="/permissies" className="underline">Open permissies</Link>
              </p>
            ) : null}
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-heading text-2xl">Recente AI-acties</h2>
              <AuditList rows={recentAi} />
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-heading text-2xl">Fouten</h2>
              <AuditList rows={errors} />
            </article>
          </section>
          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="font-heading text-2xl">Auditlog</h2>
              <a className="text-sm underline" href="/api/toezicht/export">Download JSON-export</a>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Append-only. Een toezichthoudende assistent kan later GET /api/toezicht/export lezen. Nu is er geen externe koppeling.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <select aria-label="Filter op uitkomst" className="h-10 rounded-lg border border-input bg-transparent px-2 text-sm" value={outcome} onChange={(event) => setOutcome(event.target.value as AuditOutcome | "alles")}>
                {OUTCOMES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="Filter op actor" className="h-10 rounded-lg border border-input bg-transparent px-2 text-sm" value={actor} onChange={(event) => setActor(event.target.value as "alles" | "ai" | "mens")}>
                <option value="alles">iedereen</option>
                <option value="ai">AI</option>
                <option value="mens">mens</option>
              </select>
              <select aria-label="Filter op actie" className="h-10 rounded-lg border border-input bg-transparent px-2 text-sm" value={action} onChange={(event) => setAction(event.target.value)}>
                <option value="alles">alle acties</option>
                {actions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <Input aria-label="Zoek in het log" className="h-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek" />
            </div>
            <AuditList rows={filtered.slice(0, 40)} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-3xl">{value}</p>
    </div>
  );
}

function AuditList({ rows }: { rows: AuditEntry[] }) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-muted-foreground">Niets te zien.</p>;
  return (
    <ul className="mt-3 divide-y divide-border">
      {rows.map((entry) => (
        <li key={entry.id} className="py-3 text-sm">
          <p className="font-medium">{entry.summary}</p>
          <p className="text-muted-foreground">
            {entry.outcome} · {entry.actor.kind === "ai" ? "AI" : "mens"} · {entry.action} · {new Date(entry.at).toLocaleString("nl-NL")}
          </p>
          {entry.error ? <p className="text-destructive">{entry.error}</p> : null}
          {entry.comment ? <p>Opmerking: {entry.comment}</p> : null}
        </li>
      ))}
    </ul>
  );
}
