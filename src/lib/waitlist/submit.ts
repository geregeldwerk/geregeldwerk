import { waitlistSchema, type StoredWaitlistEntry } from "@/lib/waitlist/schema";
import { allowWaitlistRequest } from "@/lib/waitlist/rate-limit";
import type { WaitlistAdapter } from "@/lib/waitlist/adapter";

export type WaitlistResult =
  | { status: 200; body: { status: "created" | "exists"; message: string } }
  | { status: 400; body: { error: string; issues?: string[] } }
  | { status: 429; body: { error: string } };

export async function submitWaitlist(
  raw: unknown,
  options: { adapter: WaitlistAdapter; ip: string; now?: number },
): Promise<WaitlistResult> {
  if (!allowWaitlistRequest(options.ip, options.now ?? Date.now())) {
    return { status: 429, body: { error: "Te veel pogingen. Probeer het zo weer." } };
  }
  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: "Controleer de velden.",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
    };
  }
  if (parsed.data.website?.trim()) {
    return { status: 200, body: { status: "created", message: "Je staat op de lijst. We mailen je als GeregeldWerk opent." } };
  }
  const entry: StoredWaitlistEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: parsed.data.name,
    email: parsed.data.email.trim().toLowerCase(),
    company: parsed.data.company?.trim() ?? "",
    industry: parsed.data.industry,
    employees: parsed.data.employees,
    country: parsed.data.country,
    plan: parsed.data.plan ? parsed.data.plan : null,
    timePain: parsed.data.timePain?.trim() ?? "",
  };
  const outcome = await options.adapter.save(entry);
  if (outcome === "exists") {
    return { status: 200, body: { status: "exists", message: "Je staat er al op." } };
  }
  return { status: 200, body: { status: "created", message: "Je staat op de lijst. We mailen je als GeregeldWerk opent." } };
}
