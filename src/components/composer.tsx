"use client";

import { Mic, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/components/feedback";
import { LineEditor } from "@/components/line-editor";
import { ApiError, api } from "@/lib/client/api";
import { collectMissingInfo } from "@/lib/domain/extract";
import { linesFromExtraction, toDraftLines, type LineDraft } from "@/lib/domain/lines";
import { parseQuantity } from "@/lib/domain/money";
import type { CompanySettings, Extraction, Quote, Task } from "@/lib/domain/types";
import { EXAMPLE_MESSAGES } from "@/lib/examples";

interface SpeechSession {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface ReviewState {
  extraction: Extraction;
  provider: string;
  warning: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  location: string;
  jobDescription: string;
  requestedDate: string;
  notes: string;
  vatRate: number;
  lines: LineDraft[];
  makeFollowUp: boolean;
  followTitle: string;
  followDetail: string;
}

export function Composer() {
  const router = useRouter();
  const recognition = useRef<SpeechSession | null>(null);
  const prefix = useRef("");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [providerNote, setProviderNote] = useState("Offline mock-assistent. Berichten blijven op deze computer.");
  const [defaultVat, setDefaultVat] = useState(0.21);

  useEffect(() => {
    const browser = window as Window & {
      SpeechRecognition?: new () => SpeechSession;
      webkitSpeechRecognition?: new () => SpeechSession;
    };
    const supported = Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition);
    void Promise.resolve().then(() => setSpeechSupported(supported));
    void api<{ provider: string; warning: string | null }>("/api/health")
      .then((health) => {
        setProviderNote(
          health.warning ??
            (health.provider === "mock"
              ? "Offline mock-assistent. Berichten blijven op deze computer."
              : "Extern taalmodel actief. Zet geen echte klantgegevens in dit prototype."),
        );
      })
      .catch(() => {
        setProviderNote("De status van de assistent kon niet worden gelezen. Mock-modus is de standaard.");
      });
    void api<{ settings: CompanySettings }>("/api/settings")
      .then((result) => setDefaultVat(result.settings.defaultVatRate))
      .catch(() => setDefaultVat(0.21));
    return () => recognition.current?.stop();
  }, []);

  function toggleSpeech() {
    const browser = window as Window & {
      SpeechRecognition?: new () => SpeechSession;
      webkitSpeechRecognition?: new () => SpeechSession;
    };
    const Ctor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const session = new Ctor();
    session.lang = "nl-NL";
    session.continuous = false;
    session.interimResults = true;
    prefix.current = text.trim();
    session.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      const base = prefix.current;
      setText(base ? `${base} ${transcript}` : transcript);
    };
    session.onerror = () => setListening(false);
    session.onend = () => setListening(false);
    recognition.current = session;
    setListening(true);
    session.start();
  }

  async function readMessage() {
    setError(null);
    setIssues([]);
    setBusy("read");
    try {
      const result = await api<{ extraction: Extraction; provider: string; warning: string | null }>(
        "/api/extract",
        { method: "POST", body: JSON.stringify({ text }) },
      );
      const extraction = result.extraction;
      setReview({
        extraction,
        provider: result.provider,
        warning: result.warning,
        customerName: extraction.customerName ?? "",
        customerPhone: extraction.customerPhone ?? "",
        customerEmail: extraction.customerEmail ?? "",
        location: extraction.location ?? "",
        jobDescription: extraction.jobDescription,
        requestedDate: extraction.requestedDate ?? "",
        notes: "",
        vatRate: defaultVat,
        lines: linesFromExtraction(extraction.lineItems),
        makeFollowUp: Boolean(extraction.followUp),
        followTitle: extraction.followUp?.title ?? "",
        followDetail: extraction.followUp?.detail ?? "",
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Het bericht kon niet worden gelezen.");
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    if (!review) return;
    setError(null);
    setIssues([]);
    setBusy("save");
    try {
      const lines = toDraftLines(review.lines);
      const result = await api<{ quote: Quote; task: Task | null }>("/api/quotes", {
        method: "POST",
        body: JSON.stringify({
          sourceText: text,
          customerName: review.customerName,
          customerPhone: review.customerPhone,
          customerEmail: review.customerEmail,
          location: review.location,
          jobDescription: review.jobDescription,
          requestedDate: review.requestedDate,
          notes: review.notes,
          vatRate: review.vatRate,
          lines,
          followUp: review.makeFollowUp
            ? { title: review.followTitle, detail: review.followDetail }
            : null,
        }),
      });
      router.push(`/offertes/${result.quote.id}`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setIssues(caught.issues);
      } else {
        setError(caught instanceof Error ? caught.message : "Opslaan mislukt.");
      }
      setBusy(null);
    }
  }

  const missing = review
    ? collectMissingInfo(text, {
        customerName: review.customerName.trim() || null,
        location: review.location.trim() || null,
        customerPhone: review.customerPhone.trim() || null,
        customerEmail: review.customerEmail.trim() || null,
        requestedDate: review.requestedDate.trim() || null,
        lineItems: review.lines
          .filter((line) => line.description.trim())
          .map((line) => ({
            description: line.description,
            quantity: parseQuantity(line.quantity),
            unit: line.unit,
          })),
      })
    : [];
  const pricesOpen = review?.lines.some((line) => line.price.trim() === "") ?? false;

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-3xl">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Nieuw bericht</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Wat heeft de klant gevraagd?</h1>
        <p className="mt-2 text-lg font-medium text-primary">Jij doet het werk, wij doen de rest</p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Plak een appje of spreek het in. Je krijgt een conceptofferte. Prijzen laat ik leeg, die vul jij in.
        </p>
      </div>

      <p className="rounded-2xl bg-secondary px-4 py-3 text-sm leading-6">{providerNote}</p>

      <form
        className="rounded-3xl border border-border bg-card p-4 shadow-sm transition duration-200 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void readMessage();
        }}
      >
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">WhatsApp</span>
          <span>binnenkomend bericht</span>
        </div>
        {text.trim() ? (
          <div className="mb-3 flex rise-in">
            <p className="max-w-[90%] rounded-3xl rounded-bl-md bg-primary/20 px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-foreground">
              {text}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-sm text-muted-foreground">Nog geen appje. Plak er een, of tik een voorbeeld.</p>
        )}
        <Label htmlFor="message" className="sr-only">Bericht van de klant</Label>
        <Textarea
          id="message"
          className="min-h-28 rounded-2xl text-base"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setReview(null);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void readMessage();
            }
          }}
          placeholder="Plak hier het appje of de mail…"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            className="h-11 px-4"
            disabled={busy !== null || text.trim().length === 0}
            onClick={() => void readMessage()}
          >
            <Send aria-hidden />
            {busy === "read" ? "Even lezen…" : "Maak concept"}
          </Button>
          <Button
            type="button"
            variant={listening ? "secondary" : "outline"}
            className="h-11"
            aria-pressed={listening}
            disabled={speechSupported === false}
            onClick={toggleSpeech}
          >
            <Mic aria-hidden />
            {listening ? "Stop" : "Spreek in"}
          </Button>
          {speechSupported === false ? (
            <p className="text-xs text-muted-foreground">
              Spraakherkenning werkt in Chrome en Edge. In deze browser typ of plak je het bericht.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Ctrl+Enter leest het bericht.</p>
          )}
        </div>
        {listening ? (
          <p className="mt-3 text-sm text-warning-foreground" role="status">
            Aan het luisteren in het Nederlands…
          </p>
        ) : null}
      </form>

      <div>
        <h2 className="text-sm font-medium">Probeer een fictief appje</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLE_MESSAGES.map((example) => (
            <Button
              key={example.id}
              type="button"
              variant="outline"
              className="h-8"
              onClick={() => {
                setText(example.text);
                setReview(null);
                setError(null);
              }}
            >
              {example.title}
            </Button>
          ))}
        </div>
      </div>

      {error ? <ErrorNote message={error} issues={issues} /> : null}

      {review ? (
        <section className="rise-in rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-live="polite">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Check dit concept</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gelezen met {review.provider === "mock" ? "de mock-assistent" : "het externe taalmodel"}.
                De regels zijn een voorstel. Bedragen blijven leeg tot jij ze invult.
              </p>
            </div>
          </div>
          {review.warning ? <p className="mt-3 text-sm text-warning-foreground">{review.warning}</p> : null}

          <div className="mt-4 rounded-xl border border-warning/40 bg-warning-bg px-4 py-3">
            <h3 className="text-sm font-medium text-warning-foreground">Nog aanvullen</h3>
            {missing.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-sm leading-6">
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm">Naam, plaats, contact, datum en werkzaamheden zijn ingevuld.</p>
            )}
            {pricesOpen ? (
              <p className="mt-2 text-sm">
                Prijzen zijn nog leeg. Dat is expres: Geregeldwerk verzint of kopieert geen bedragen.
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Klant" id="customerName">
              <Input
                id="customerName"
                className="h-10"
                autoComplete="off"
                value={review.customerName}
                onChange={(event) => setReview({ ...review, customerName: event.target.value })}
              />
            </Field>
            <Field label="Plaats of adres" id="location">
              <Input
                id="location"
                className="h-10"
                autoComplete="off"
                value={review.location}
                onChange={(event) => setReview({ ...review, location: event.target.value })}
              />
            </Field>
            <Field label="Telefoon" id="customerPhone">
              <Input
                id="customerPhone"
                className="h-10"
                autoComplete="off"
                value={review.customerPhone}
                onChange={(event) => setReview({ ...review, customerPhone: event.target.value })}
              />
            </Field>
            <Field label="E-mail" id="customerEmail">
              <Input
                id="customerEmail"
                className="h-10"
                autoComplete="off"
                value={review.customerEmail}
                onChange={(event) => setReview({ ...review, customerEmail: event.target.value })}
              />
            </Field>
            <Field label="Gewenste datum" id="requestedDate">
              <Input
                id="requestedDate"
                className="h-10"
                value={review.requestedDate}
                onChange={(event) => setReview({ ...review, requestedDate: event.target.value })}
              />
            </Field>
            <Field label="BTW" id="vatRate">
              <select
                id="vatRate"
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={String(review.vatRate)}
                onChange={(event) => setReview({ ...review, vatRate: Number(event.target.value) })}
              >
                <option value="0.21">21%</option>
                <option value="0.09">9%</option>
                <option value="0">0%</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Omschrijving van het werk" id="jobDescription">
              <Textarea
                id="jobDescription"
                value={review.jobDescription}
                onChange={(event) => setReview({ ...review, jobDescription: event.target.value })}
              />
            </Field>
          </div>

          <h3 className="mt-6 text-sm font-medium">Voorgestelde regels</h3>
          <p className="mb-3 text-sm text-muted-foreground">Zonder bedragen. Pas omschrijving, aantal en prijs aan.</p>
          <LineEditor lines={review.lines} onChange={(lines) => setReview({ ...review, lines })} />

          <div className="mt-4">
            <Field label="Opmerking op de offerte" id="notes">
              <Textarea
                id="notes"
                value={review.notes}
                onChange={(event) => setReview({ ...review, notes: event.target.value })}
              />
            </Field>
          </div>

          <div className="mt-5 rounded-xl bg-muted px-4 py-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={review.makeFollowUp}
                onChange={(event) => setReview({ ...review, makeFollowUp: event.target.checked })}
              />
              <span>Maak ook een herinnering</span>
            </label>
            {review.makeFollowUp ? (
              <div className="mt-3 grid gap-3">
                <Field label="Titel" id="followTitle">
                  <Input
                    id="followTitle"
                    className="h-10"
                    value={review.followTitle}
                    onChange={(event) => setReview({ ...review, followTitle: event.target.value })}
                  />
                </Field>
                <Field label="Toelichting" id="followDetail">
                  <Textarea
                    id="followDetail"
                    value={review.followDetail}
                    onChange={(event) => setReview({ ...review, followDetail: event.target.value })}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <Button type="button" className="mt-5 h-10 px-4" disabled={busy !== null} onClick={() => void saveDraft()}>
            {busy === "save" ? "Opslaan…" : "Opslaan als concept"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
