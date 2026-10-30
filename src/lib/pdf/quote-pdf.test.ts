import { describe, expect, it } from "vitest";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { createSeedData } from "@/lib/storage/seed";

describe("renderQuotePdf", () => {
  it("maakt een pdf-bestand voor een voorbeeldofferte", async () => {
    const { quotes, settings } = createSeedData();
    const bytes = await renderQuotePdf(quotes[1], settings);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});
