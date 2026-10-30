import { extractFromMessage } from "@/lib/domain/extract";
import type { LlmProvider } from "@/lib/llm/types";

export const mockProvider: LlmProvider = {
  id: "mock",
  async extract(message: string) {
    return extractFromMessage(message);
  },
};
