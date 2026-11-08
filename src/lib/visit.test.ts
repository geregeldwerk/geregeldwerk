import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_COLLECT_URL,
  buildVisitPayload,
  reportPageView,
  resetVisitDedupe,
  resolveCollectUrl,
  sanitizePath,
  sanitizeReferrer,
  type PageViewContext,
} from "@/lib/visit";

const QUOTE_ID = "quote-voorbeeld-concept";
const INVOICE_ID = "invoice-3f1c0a2e-7b4d-4e1a-9c2b-6d5e4f3a2b10";

function production(overrides: PageViewContext = {}): PageViewContext {
  return {
    nodeEnv: "production",
    doNotTrack: null,
    globalPrivacyControl: false,
    referrer: "",
    ...overrides,
  };
}

describe("bezoekersteller", () => {
  beforeEach(() => {
    resetVisitDedupe();
  });

  it("houdt vaste pagina's en vervangt offerte- en factuur-id's", () => {
    for (const path of ["/", "/offertes", "/permissies", "/taken", "/toezicht", "/boekhouding", "/instellingen", "/marketing"]) {
      expect(sanitizePath(path)).toBe(path);
    }

    expect(sanitizePath(`/offertes/${QUOTE_ID}`)).toBe("/offertes/:id");
    expect(sanitizePath(`/offertes/${INVOICE_ID}/afdrukken`)).toBe("/offertes/:id/afdrukken");
    expect(sanitizePath("/offertes/afdrukken")).toBe("/offertes/:id");
    expect(sanitizePath(`/facturen/${INVOICE_ID}`)).toBe("/facturen/:id");
    expect(sanitizePath("/facturen/FAC-2026-0012")).toBe("/facturen/:id");
    expect(sanitizePath("/offertes/Familie%20Vermeer?email=jan@example.com&telefoon=0612345678")).toBe("/offertes/:id");
    expect(sanitizePath("/boekhouding#klant")).toBe("/boekhouding");
    expect(sanitizePath("/offertes/")).toBe("/offertes");
  });

  it("stuurt site, pad en referrer zonder query of id", () => {
    expect(
      buildVisitPayload(`/offertes/${QUOTE_ID}?klant=Jansen`, "https://www.google.com/search?q=klusbedrijf"),
    ).toEqual({
      site: "geregeldwerk",
      path: "/offertes/:id",
      referrer: "https://www.google.com/search",
    });

    expect(
      buildVisitPayload("/taken", `https://geregeldwerk.vercel.app/facturen/${INVOICE_ID}?x=1`),
    ).toEqual({
      site: "geregeldwerk",
      path: "/taken",
      referrer: `https://geregeldwerk.vercel.app/facturen/:id`,
    });

    expect(buildVisitPayload("/", "")).toEqual({ site: "geregeldwerk", path: "/" });
    expect(buildVisitPayload("/", "javascript:alert(1)")).toEqual({ site: "geregeldwerk", path: "/" });
    expect(sanitizePath("/klanten/Jansen")).toBe("/klanten/:id");
    expect(sanitizePath("/Pieter%20de%20Vries")).toBe("/:id");
    expect(sanitizeReferrer("https://github.com/codedbydefault/geregeldwerk?tab=readme")).toBe(
      "https://github.com/codedbydefault/geregeldwerk",
    );
    expect(sanitizeReferrer("https://nieuws.example/users/jan@example.com")).toBe("https://nieuws.example/users/:id");
    expect(sanitizeReferrer("http://127.0.0.1:4319/referrer.html?q=geheim")).toBe("http://127.0.0.1:4319/referrer.html");
  });

  it("gebruikt sendBeacon met een JSON-string en het standaardendpoint", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn();

    reportPageView("/boekhouding", production({ sendBeacon, fetch: fetchMock, referrer: "" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, body] = sendBeacon.mock.calls[0] as [string, unknown];
    expect(url).toBe(DEFAULT_COLLECT_URL);
    expect(typeof body).toBe("string");
    expect(body).not.toBeInstanceOf(Blob);
    expect(JSON.parse(body as string)).toEqual({ site: "geregeldwerk", path: "/boekhouding" });
  });

  it("valt terug op fetch met keepalive zonder cookies", () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);

    reportPageView(`/facturen/${INVOICE_ID}`, production({ sendBeacon: () => false, fetch: fetchMock }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_COLLECT_URL);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({ "Content-Type": "text/plain;charset=UTF-8" });
    expect(typeof init.body).toBe("string");
    expect(JSON.parse(init.body as string)).toEqual({ site: "geregeldwerk", path: "/facturen/:id" });
    expect(init.body).not.toContain(INVOICE_ID);
  });

  it("telt elke paginaweergave één keer, ook als het opgeschoonde pad hetzelfde is", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const context = production({ sendBeacon });

    reportPageView(`/offertes/${QUOTE_ID}`, context);
    reportPageView(`/offertes/${QUOTE_ID}?klant=Jansen`, context);
    reportPageView(`/offertes/${QUOTE_ID}/`, context);
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    reportPageView("/offertes/ander-id", context);
    expect(sendBeacon).toHaveBeenCalledTimes(2);

    const paths = sendBeacon.mock.calls.map((call) => JSON.parse(call[1] as string).path);
    expect(paths).toEqual(["/offertes/:id", "/offertes/:id"]);
    expect(JSON.stringify(sendBeacon.mock.calls)).not.toMatch(/Jansen|quote-voorbeeld|ander-id/);
  });

  it("stuurt niet bij ontwikkeling, Do Not Track of Global Privacy Control", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);

    reportPageView("/taken", production({ nodeEnv: "development", sendBeacon }));
    reportPageView("/taken", production({ nodeEnv: "test", sendBeacon }));
    reportPageView("/taken", production({ doNotTrack: "1", sendBeacon }));
    reportPageView("/taken", production({ doNotTrack: "yes", sendBeacon }));
    reportPageView("/taken", production({ globalPrivacyControl: true, sendBeacon }));
    reportPageView("/taken", production({ globalPrivacyControl: "1", sendBeacon }));

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("negeert een falende beacon en een afgewezen fetch", async () => {
    const failure = Promise.reject(new Error("offline"));
    expect(() =>
      reportPageView("/instellingen", production({
        sendBeacon: () => {
          throw new Error("beacon");
        },
        fetch: () => failure,
      })),
    ).not.toThrow();
    await failure.catch(() => undefined);

    expect(() =>
      reportPageView("/marketing", production({
        sendBeacon: () => false,
        fetch: () => {
          throw new Error("kapot");
        },
      })),
    ).not.toThrow();
  });

  it("laat het endpoint instellen en valt terug op het vaste adres", () => {
    expect(resolveCollectUrl(undefined)).toBe(DEFAULT_COLLECT_URL);
    expect(resolveCollectUrl("")).toBe(DEFAULT_COLLECT_URL);
    expect(resolveCollectUrl("   ")).toBe(DEFAULT_COLLECT_URL);
    expect(resolveCollectUrl("javascript:alert(1)")).toBe(DEFAULT_COLLECT_URL);
    expect(resolveCollectUrl("geen-url")).toBe(DEFAULT_COLLECT_URL);
    expect(resolveCollectUrl("https://user:geheim@collect.example/hook")).toBe("https://collect.example/hook");
    expect(resolveCollectUrl("https://collect.example/hook")).toBe("https://collect.example/hook");

    const sendBeacon = vi.fn().mockReturnValue(true);
    reportPageView("/", production({ sendBeacon, endpoint: "https://collect.example/hook" }));
    expect(sendBeacon.mock.calls[0]?.[0]).toBe("https://collect.example/hook");
  });

  it("bewaart geen cookie of localStorage-id", () => {
    const files = ["./visit.ts", "../components/visit-beacon.tsx"].map((relative) =>
      readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"),
    );
    for (const source of files) {
      expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    }
  });
});
