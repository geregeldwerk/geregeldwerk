"use client";

import { useEffect, useState } from "react";
import { ErrorNote, LoadingNote } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import type { LeadEntry, SocialChannel, SocialPost } from "@/lib/domain/types";

const COLUMNS = ["concept", "ingepland", "gepubliceerd"] as const;

export default function MarketingPage() {
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [leads, setLeads] = useState<LeadEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<SocialChannel>("instagram");
  const [lead, setLead] = useState({ source: "Mond-tot-mond", name: "", note: "" });
  const [when, setWhen] = useState<Record<string, string>>({});

  function load() {
    void api<{ posts: SocialPost[]; leads: LeadEntry[] }>("/api/marketing")
      .then((data) => {
        setPosts(data.posts);
        setLeads(data.leads);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Laden mislukt."));
  }

  useEffect(() => {
    load();
  }, []);

  async function addPost() {
    setError(null);
    try {
      await api("/api/marketing", { method: "POST", body: JSON.stringify({ kind: "post", channel, body }) });
      setBody("");
      setNotice("Concept opgeslagen. Publiceren is gesimuleerd en loopt via de permissie.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opslaan mislukt.");
    }
  }

  async function schedule(id: string) {
    setError(null);
    try {
      await api(`/api/marketing/${id}`, { method: "POST", body: JSON.stringify({ scheduledFor: when[id] ?? "" }) });
      setNotice("Ingepland. Nog niet gepubliceerd.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inplannen mislukt.");
    }
  }

  async function publish(id: string) {
    setError(null);
    try {
      const result = await api<{ effect: string; reason: string }>("/api/acties", {
        method: "POST",
        body: JSON.stringify({ actor: "ai", payload: { type: "social_publiceren", postId: id } }),
      });
      setNotice(
        result.effect === "uitgevoerd"
          ? "Gesimuleerd gepubliceerd. Er is niets naar een sociaal netwerk gestuurd."
          : `${result.reason} Niets is gepubliceerd tot je goedkeurt in Toezicht.`,
      );
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publiceren mislukt.");
    }
  }

  async function addLead() {
    setError(null);
    try {
      await api("/api/marketing", { method: "POST", body: JSON.stringify({ kind: "lead", ...lead }) });
      setLead({ source: lead.source, name: "", note: "" });
      setNotice("Lead in het groeilogboek gezet.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lead opslaan mislukt.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Marketing</p>
        <h1 className="mt-2 font-heading text-4xl tracking-tight">Posts en een groeilogboek</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Concept, ingepland, gepubliceerd. Publiceren is een permissie en blijft een simulatie: Geregeldwerk praat niet met Instagram, Facebook of LinkedIn.
        </p>
      </div>
      {error ? <ErrorNote message={error} /> : null}
      {notice ? <p className="rounded-xl bg-secondary px-4 py-3 text-sm" role="status">{notice}</p> : null}
      <form
        className="rounded-2xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void addPost();
        }}
      >
        <Label htmlFor="channel">Kanaal</Label>
        <select id="channel" className="mt-1.5 h-10 rounded-lg border border-input bg-transparent px-2 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as SocialChannel)}>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <Label htmlFor="post" className="mt-3">Tekst</Label>
        <Textarea id="post" className="mt-1.5" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Fictieve tip voor je klanten" />
        <Button type="button" className="mt-3 h-10" disabled={!body.trim()} onClick={() => void addPost()}>Concept opslaan</Button>
      </form>
      {posts === null && !error ? <LoadingNote label="Marketing laden…" /> : null}
      {posts ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((status) => (
            <section key={status} className="rounded-2xl border border-border bg-card p-3">
              <h2 className="px-1 font-heading text-xl capitalize">{status}</h2>
              <ul className="mt-2 grid gap-2">
                {posts.filter((post) => post.status === status).map((post) => (
                  <li key={post.id} className="rounded-xl bg-muted px-3 py-3 text-sm">
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">{post.channel}{post.example ? " · voorbeeld" : ""}</p>
                    <p className="mt-1 leading-6">{post.body}</p>
                    {post.status === "concept" ? (
                      <div className="mt-2">
                        <Label htmlFor={`when-${post.id}`}>Inplannen</Label>
                        <Input id={`when-${post.id}`} className="mt-1 h-10" value={when[post.id] ?? ""} onChange={(event) => setWhen({ ...when, [post.id]: event.target.value })} placeholder="2026-11-02 09:00" />
                        <Button type="button" variant="outline" className="mt-2 h-8" disabled={!when[post.id]?.trim()} onClick={() => void schedule(post.id)}>Zet op ingepland</Button>
                      </div>
                    ) : null}
                    {post.status !== "gepubliceerd" ? (
                      <Button type="button" className="mt-2 h-8" onClick={() => void publish(post.id)}>Publiceer via permissie</Button>
                    ) : (
                      <p className="mt-2 text-xs">Gesimuleerd gepubliceerd{post.publishedAt ? ` op ${new Date(post.publishedAt).toLocaleString("nl-NL")}` : ""}.</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-heading text-2xl">Groei / leads</h2>
        <p className="mt-1 text-sm text-muted-foreground">{leads.length} genoteerde leads, allemaal lokaal. Geen advertentieplatform.</p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            void addLead();
          }}
        >
          <div>
            <Label htmlFor="source">Bron</Label>
            <Input id="source" className="mt-1.5 h-10" value={lead.source} onChange={(event) => setLead({ ...lead, source: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="lead-name">Naam</Label>
            <Input id="lead-name" className="mt-1.5 h-10" autoComplete="off" value={lead.name} onChange={(event) => setLead({ ...lead, name: event.target.value })} />
          </div>
          <div>
            <Label htmlFor="lead-note">Notitie</Label>
            <Input id="lead-note" className="mt-1.5 h-10" value={lead.note} onChange={(event) => setLead({ ...lead, note: event.target.value })} />
          </div>
          <Button type="button" className="h-10 sm:col-span-3 sm:w-fit" disabled={!lead.name.trim()} onClick={() => void addLead()}>Lead noteren</Button>
        </form>
        <ul className="mt-4 divide-y divide-border">
          {leads.map((item) => (
            <li key={item.id} className="py-3 text-sm">
              <p className="font-medium">{item.name}{item.example ? " · voorbeeld" : ""}</p>
              <p className="text-muted-foreground">{item.source} · {item.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
