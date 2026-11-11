import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredWaitlistEntry } from "@/lib/waitlist/schema";
import type { WaitlistAdapter } from "@/lib/waitlist/adapter";
import { resetWaitlistRateLimit } from "@/lib/waitlist/rate-limit";

vi.mock("next/server", () => ({ connection: async () => undefined }));

const save = vi.fn<(entry: StoredWaitlistEntry) => Promise<"created" | "exists">>();
const adapter: WaitlistAdapter = { save, list: async () => [] };

vi.mock("@/lib/waitlist/adapter", () => ({
  getWaitlistAdapter: () => adapter,
}));

import { POST } from "@/app/api/waitlist/route";

const valid = {
  name: "Jan de Tester",
  email: "jan@example.test",
  company: "Testbedrijf",
  industry: "bouw/installatie",
  employees: "zzp",
  country: "NL",
  plan: "starter",
  timePain: "Prijzen overtypen",
  consent: true,
  website: "",
};

function post(body: unknown, ip: string) {
  return POST(new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }));
}

describe("wachtlijstroute", () => {
  beforeEach(() => {
    save.mockReset();
    save.mockResolvedValue("created");
    resetWaitlistRateLimit();
  });

  it("weigert een ongeldig e-mailadres", async () => {
    const response = await post({ ...valid, email: "geen-mail" }, "10.0.0.1");
    expect(response.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it("bewaart een honeypot-inzending niet", async () => {
    const response = await post({ ...valid, website: "https://spam.test" }, "10.0.0.2");
    expect(response.status).toBe(200);
    expect(save).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ status: "created" });
  });

  it("zegt vriendelijk dat een dubbel adres er al op staat", async () => {
    save.mockResolvedValue("exists");
    const response = await post(valid, "10.0.0.3");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "exists", message: "Je staat er al op." });
  });

  it("schrijft een geldige aanmelding weg", async () => {
    const response = await post(valid, "10.0.0.4");
    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({ status: "created" });
  });
});
