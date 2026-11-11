import { getRepository } from "@/lib/storage";
import type { StoredWaitlistEntry } from "@/lib/waitlist/schema";

export interface WaitlistAdapter {
  save(entry: StoredWaitlistEntry): Promise<"created" | "exists">;
  list(): Promise<StoredWaitlistEntry[]>;
}

type WaitlistEnv = { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };

let warnedLocal = false;

export function waitlistBackend(env?: WaitlistEnv): "supabase" | "local" {
  const source = env ?? process.env;
  const url = source.SUPABASE_URL?.trim();
  const key = source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? "supabase" : "local";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createLocalWaitlistAdapter(warn = true): WaitlistAdapter {
  if (warn && !warnedLocal) {
    warnedLocal = true;
    console.warn(
      "Wachtlijst staat in lokale opslag. Op Vercel is die niet blijvend. Zet SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return {
    async save(entry) {
      const email = normalizeEmail(entry.email);
      let result: "created" | "exists" = "created";
      await getRepository().update((data) => {
        data.waitlist ??= [];
        if (data.waitlist.some((item) => item.email.toLowerCase() === email)) {
          result = "exists";
          return;
        }
        data.waitlist.push({ ...entry, email });
      });
      return result;
    },
    async list() {
      const data = await getRepository().read();
      return [...(data.waitlist ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}

export function createSupabaseWaitlistAdapter(url: string, key: string, fetchImpl: typeof fetch = fetch): WaitlistAdapter {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/waitlist`;
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  return {
    async save(entry) {
      const email = normalizeEmail(entry.email);
      const existing = await fetchImpl(`${endpoint}?email=eq.${encodeURIComponent(email)}&select=id`, { headers });
      if (!existing.ok) throw new Error("Supabase-wachtlijst is niet bereikbaar.");
      const rows = (await existing.json()) as unknown[];
      if (rows.length > 0) return "exists";
      const inserted = await fetchImpl(endpoint, {
        method: "POST",
        headers: { ...headers, prefer: "return=minimal" },
        body: JSON.stringify({
          id: entry.id,
          created_at: entry.createdAt,
          name: entry.name,
          email,
          company: entry.company,
          industry: entry.industry,
          employees: entry.employees,
          country: entry.country,
          plan: entry.plan,
          time_pain: entry.timePain,
          consent: true,
        }),
      });
      if (inserted.status === 409) return "exists";
      if (!inserted.ok) throw new Error("Opslaan in Supabase is mislukt.");
      return "created";
    },
    async list() {
      const response = await fetchImpl(`${endpoint}?select=*&order=created_at.desc`, { headers });
      if (!response.ok) throw new Error("Wachtlijst lezen uit Supabase is mislukt.");
      const rows = (await response.json()) as Array<Record<string, string | null>>;
      return rows.map((row) => ({
        id: String(row.id),
        createdAt: String(row.created_at),
        name: String(row.name),
        email: String(row.email),
        company: String(row.company ?? ""),
        industry: row.industry as StoredWaitlistEntry["industry"],
        employees: row.employees as StoredWaitlistEntry["employees"],
        country: row.country === "BE" ? "BE" : "NL",
        plan: (row.plan as StoredWaitlistEntry["plan"]) ?? null,
        timePain: String(row.time_pain ?? ""),
      }));
    },
  };
}

export function getWaitlistAdapter(env?: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }): WaitlistAdapter {
  const source = env ?? process.env;
  const url = source.SUPABASE_URL?.trim();
  const key = source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return createSupabaseWaitlistAdapter(url, key);
  return createLocalWaitlistAdapter();
}
