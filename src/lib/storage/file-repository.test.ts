import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFileRepository } from "@/lib/storage/file-repository";

describe("file repository", () => {
  it("schrijft een conceptofferte naar een lokaal bestand en leest hem terug", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "geregeldwerk-"));
    const file = path.join(dir, "store.json");
    const repository = createFileRepository(file);

    const created = await repository.update((data) => {
      data.quotes.unshift({
        ...data.quotes[0],
        id: "quote-test",
        number: "OFF-2026-099",
        customerName: "Testklant",
        example: false,
      });
    });

    expect(created.quotes[0]?.customerName).toBe("Testklant");
    const fresh = createFileRepository(file);
    const again = await fresh.read();
    expect(again.quotes.some((quote) => quote.id === "quote-test")).toBe(true);
    const raw = await readFile(file, "utf8");
    expect(raw).toContain("Testklant");
    expect(again.settings.companyName).toBe("Installatiebedrijf Voorbeeld");
  });
});
