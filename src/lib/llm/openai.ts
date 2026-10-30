import { sanitizeExtraction } from "@/lib/domain/sanitize";
import type { LlmProvider } from "@/lib/llm/types";

const SYSTEM_PROMPT = `Je bent de administratie-assistent van een Nederlands installatiebedrijf.
Extraheer alleen feiten die letterlijk in het bericht staan. Verzin niets.
Antwoord met JSON:
{
  "customerName": string | null,
  "customerPhone": string | null,
  "customerEmail": string | null,
  "location": string | null,
  "jobDescription": string,
  "requestedDate": string | null,
  "lineItems": [{ "description": string, "quantity": number | null, "unit": string | null }]
}
Regels:
- Geen prijzen, uurtarieven, bedragen of totalen. Laat die weg, ook als het bericht een bedrag noemt.
- Vul ontbrekende gegevens niet met een gok.
- quantity en unit zijn null als ze niet in het bericht staan.
- Antwoord in het Nederlands, alleen JSON.`;

export function createOpenAiProvider(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): LlmProvider {
  return {
    id: "openai",
    async extract(message: string) {
      const endpoint = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: message },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`De LLM-provider antwoordde met status ${response.status}.`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("De LLM-provider gaf geen tekst terug.");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("De LLM-provider gaf geen geldige JSON.");
      }

      return sanitizeExtraction(parsed, message);
    },
  };
}
