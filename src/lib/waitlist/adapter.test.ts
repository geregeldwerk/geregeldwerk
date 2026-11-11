import { describe, expect, it } from "vitest";
import { waitlistBackend } from "@/lib/waitlist/adapter";

describe("wachtlijstadapter", () => {
  it("valt terug op lokale opslag zonder Supabase", () => {
    expect(waitlistBackend({})).toBe("local");
    expect(waitlistBackend({ SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "" })).toBe("local");
    expect(waitlistBackend({ SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "service-role" })).toBe("supabase");
  });
});
