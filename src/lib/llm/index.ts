import { createOpenAiProvider } from "@/lib/llm/openai";
import { mockProvider } from "@/lib/llm/mock";
import type { ResolvedProvider } from "@/lib/llm/types";

export function resolveProvider(env: Record<string, string | undefined> = process.env): ResolvedProvider {
  const name = (env.GEREGELDWERK_LLM_PROVIDER ?? "mock").trim().toLowerCase();
  if (name === "" || name === "mock" || name === "offline") {
    return { provider: mockProvider, warning: null };
  }

  if (name === "openai") {
    const apiKey = env.GEREGELDWERK_LLM_API_KEY?.trim();
    if (!apiKey) {
      return {
        provider: mockProvider,
        warning:
          "GEREGELDWERK_LLM_PROVIDER=openai, maar GEREGELDWERK_LLM_API_KEY ontbreekt. Mock-modus gebruikt.",
      };
    }
    return {
      provider: createOpenAiProvider({
        apiKey,
        baseUrl: env.GEREGELDWERK_LLM_BASE_URL?.trim() || "https://api.openai.com/v1",
        model: env.GEREGELDWERK_LLM_MODEL?.trim() || "gpt-4o-mini",
      }),
      warning: null,
    };
  }

  return {
    provider: mockProvider,
    warning: `Onbekende provider "${name}". Mock-modus gebruikt.`,
  };
}
