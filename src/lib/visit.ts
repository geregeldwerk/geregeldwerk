/**
 * Cookieloze paginamelding voor het dashboard op codedbydefault.com.
 * Alleen in productie, één keer per paginaweergave, zonder id's of querystrings.
 */

export const DEFAULT_COLLECT_URL = "https://www.codedbydefault.com/api/collect";

const VISIT_SITE = "geregeldwerk";
const ID_PLACEHOLDER = ":id";

/** Vaste paginastukken. Alles daarbuiten in een dieper segment telt als id. */
const STATIC_SEGMENTS = new Set([
  "offertes",
  "permissies",
  "taken",
  "toezicht",
  "boekhouding",
  "instellingen",
  "marketing",
  "facturen",
]);

const ID_PREFIX =
  /^(?:quote|offerte|invoice|factuur|task|taak|line|expense|post|lead|approval|perm|permissie|audit|appointment|afspraak|mock|klant|customer)-/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VisitPayload = {
  site: typeof VISIT_SITE;
  path: string;
  referrer?: string;
};

export type VisitTransport = {
  sendBeacon?: (url: string, body: string) => boolean;
  fetch?: (url: string, init: RequestInit) => Promise<unknown> | unknown;
};

export type PageViewContext = VisitTransport & {
  nodeEnv?: string;
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean | number | string | null;
  referrer?: string | null;
  endpoint?: string;
};

let lastVisitKey: string | null = null;

export function resetVisitDedupe(): void {
  lastVisitKey = null;
}

export function resolveCollectUrl(configured = process.env.NEXT_PUBLIC_VISIT_COLLECT_URL): string {
  const value = configured?.trim();
  if (!value) return DEFAULT_COLLECT_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return DEFAULT_COLLECT_URL;
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return DEFAULT_COLLECT_URL;
  }
}

export function sanitizePath(input: string): string {
  const segments = pathSegments(input);
  if (segments.length === 0) return "/";

  const safe = segments.map((segment, index) => {
    if (segment.includes("/") || segment.includes("\\") || segment.includes("?") || segment.includes("#")) {
      return ID_PLACEHOLDER;
    }
    if (segment === "afdrukken" && segments[index - 2] === "offertes") return segment;
    if (STATIC_SEGMENTS.has(segment)) return segment;
    if (index > 0 || looksLikeIdentifier(segment) || !isSafePublicSlug(segment)) return ID_PLACEHOLDER;
    return segment;
  });

  return `/${safe.join("/")}`;
}

export function sanitizeReferrer(referrer: string | null | undefined): string | undefined {
  const trimmed = referrer?.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return `${url.origin}${sanitizeReferrerPath(url.pathname)}`;
  } catch {
    return undefined;
  }
}

/** Referrers houden hun pad, maar verliezen query's, id's en onze offerte- of factuursegmenten. */
function sanitizeReferrerPath(pathname: string): string {
  const segments = visitKey(pathname).split("/").filter(Boolean).map(decodeSegment);
  if (segments.length === 0) return "/";

  const safe = segments.map((segment, index) => {
    if (segment === "afdrukken" && segments[index - 2] === "offertes") return segment;
    if (STATIC_SEGMENTS.has(segment)) return segment;
    if (looksLikeIdentifier(segment)) return ID_PLACEHOLDER;
    const parent = segments[index - 1];
    if (parent === "offertes" || parent === "facturen") return ID_PLACEHOLDER;
    return segment;
  });

  return `/${safe.join("/")}`;
}

export function buildVisitPayload(pathname: string, referrer?: string | null): VisitPayload {
  const payload: VisitPayload = {
    site: VISIT_SITE,
    path: sanitizePath(pathname),
  };
  const cleanReferrer = sanitizeReferrer(referrer);
  if (cleanReferrer) payload.referrer = cleanReferrer;
  return payload;
}

export function reportPageView(pathname: string, context?: PageViewContext): void {
  try {
    if (!context && typeof window === "undefined") return;

    const nodeEnv = context?.nodeEnv ?? process.env.NODE_ENV;
    if (nodeEnv !== "production") return;

    const doNotTrack = context ? (context.doNotTrack ?? null) : readDoNotTrack();
    const globalPrivacyControl = context ? (context.globalPrivacyControl ?? false) : readGlobalPrivacyControl();
    if (hasPrivacyOptOut(doNotTrack, globalPrivacyControl)) return;

    const key = visitKey(pathname);
    if (key === lastVisitKey) return;
    lastVisitKey = key;

    const referrer = context ? context.referrer : typeof document !== "undefined" ? document.referrer : "";
    const endpoint = context?.endpoint?.trim() || resolveCollectUrl();
    const payload = buildVisitPayload(key, referrer);
    deliverVisit(endpoint, payload, {
      sendBeacon: context ? context.sendBeacon : readSendBeacon(),
      fetch: context ? context.fetch : readFetch(),
    });
  } catch {
    return;
  }
}

function deliverVisit(endpoint: string, payload: VisitPayload, transport: VisitTransport): void {
  const body = JSON.stringify(payload);
  try {
    if (transport.sendBeacon?.(endpoint, body) === true) return;
  } catch {
    // sendBeacon faalde; fetch is de terugval.
  }

  if (!transport.fetch) return;

  try {
    // Zelfde string als sendBeacon (text/plain), keepalive, geen cookies.
    void Promise.resolve(
      transport.fetch(endpoint, {
        method: "POST",
        body,
        keepalive: true,
        credentials: "omit",
        cache: "no-store",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
      }),
    ).catch(() => undefined);
  } catch {
    return;
  }
}

function hasPrivacyOptOut(
  doNotTrack: string | null,
  globalPrivacyControl: boolean | number | string | null,
): boolean {
  if (doNotTrack === "1" || doNotTrack === "yes") return true;
  return globalPrivacyControl === true || globalPrivacyControl === 1 || globalPrivacyControl === "1";
}

function pathSegments(input: string): string[] {
  return visitKey(input).split("/").filter(Boolean).map(decodeSegment);
}

function visitKey(input: string): string {
  const trimmed = input.trim();
  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      pathname = "/";
    }
  }
  const hashAt = pathname.indexOf("#");
  const withoutHash = hashAt === -1 ? pathname : pathname.slice(0, hashAt);
  const queryAt = withoutHash.indexOf("?");
  const withoutQuery = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const withSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const collapsed = withSlash.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) return collapsed.replace(/\/+$/, "");
  return collapsed || "/";
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function looksLikeIdentifier(segment: string): boolean {
  if (UUID_PATTERN.test(segment)) return true;
  if (ID_PREFIX.test(segment)) return true;
  if (segment.includes("@")) return true;
  if (/^\+?\d[\d\s().-]{5,}\d$/.test(segment)) return true;
  if (segment.length >= 20 && /\d/.test(segment) && /[a-z]/i.test(segment)) return true;
  return false;
}

function isSafePublicSlug(segment: string): boolean {
  return /^[a-z0-9-]{1,48}$/.test(segment);
}

function readDoNotTrack(): string | null {
  const values: Array<string | null | undefined> = [];
  if (typeof navigator !== "undefined") {
    const nav = navigator as Navigator & { msDoNotTrack?: string };
    values.push(nav.doNotTrack, nav.msDoNotTrack);
  }
  if (typeof window !== "undefined") {
    values.push((window as Window & { doNotTrack?: string }).doNotTrack);
  }
  if (values.some((value) => value === "1" || value === "yes")) return "1";
  return null;
}

function readGlobalPrivacyControl(): boolean {
  if (typeof navigator === "undefined") return false;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  return gpc === true;
}

function readSendBeacon(): VisitTransport["sendBeacon"] {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return undefined;
  return (url, body) => navigator.sendBeacon(url, body);
}

function readFetch(): VisitTransport["fetch"] {
  if (typeof fetch !== "function") return undefined;
  return (url, init) => fetch(url, init);
}
