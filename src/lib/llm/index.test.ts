import { afterEach, describe, expect, it } from "vitest";
import { resolveProvider } from "@/lib/llm/index";

const KEYS = ["GEREGELDWERK_LLM_PROVIDER", "GEREGELDWERK_LLM_API_KEY", "GEREGELDWERK_LLM_BASE_URL", "GEREGELDWERK_LLM_MODEL"] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("resolveProvider", () => {
  it("kiest mock als er niets is ingesteld", () => {
    const resolved = resolveProvider({});
    expect(resolved.provider.id).toBe("mock");
    expect(resolved.warning).toBeNull();
  });

  it("valt terug op mock als openai geen sleutel heeft", () => {
    const resolved = resolveProvider({ GEREGELDWERK_LLM_PROVIDER: "openai" });
    expect(resolved.provider.id).toBe("mock");
    expect(resolved.warning).toMatch(/API_KEY ontbreekt/);
  });

  it("gebruikt openai als provider en sleutel zijn gezet, zonder de sleutel te loggen", () => {
    const resolved = resolveProvider({
      GEREGELDWERK_LLM_PROVIDER: "openai",
      GEREGELDWERK_LLM_API_KEY: "test-sleutel-niet-loggen",
      GEREGELDWERK_LLM_MODEL: "gpt-test",
    });
    expect(resolved.provider.id).toBe("openai");
    expect(resolved.warning).toBeNull();
    expect(JSON.stringify(resolved.warning)).not.toContain("test-sleutel");
  });
});
