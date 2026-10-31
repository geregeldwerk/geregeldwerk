import type { Extraction } from "@/lib/domain/types";

export interface LlmProvider {
  readonly id: "mock" | "openai";
  extract(message: string): Promise<Extraction>;
}

export interface ResolvedProvider {
  provider: LlmProvider;
  warning: string | null;
}
