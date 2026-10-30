import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreData } from "@/lib/domain/types";
import { createSeedData } from "@/lib/storage/seed";

export function normalizeStore(input: Partial<StoreData> | null | undefined): StoreData {
  const seed = createSeedData();
  if (!input || !Array.isArray(input.quotes) || !input.settings) return seed;
  return {
    quotes: input.quotes,
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    settings: input.settings,
    permissions: input.permissions ?? seed.permissions,
    approvals: Array.isArray(input.approvals) ? input.approvals : [],
    permissionProposals: Array.isArray(input.permissionProposals) ? input.permissionProposals : [],
    audit: Array.isArray(input.audit) ? input.audit : [],
    invoices: Array.isArray(input.invoices) ? input.invoices : [],
    expenses: Array.isArray(input.expenses) ? input.expenses : [],
    appointments: Array.isArray(input.appointments) ? input.appointments : [],
    posts: Array.isArray(input.posts) ? input.posts : [],
    leads: Array.isArray(input.leads) ? input.leads : [],
  };
}

export interface Repository {
  read(): Promise<StoreData>;
  update(mutator: (data: StoreData) => void): Promise<StoreData>;
}

export function createFileRepository(filePath: string): Repository {
  let queue: Promise<unknown> = Promise.resolve();

  async function ensure(): Promise<StoreData> {
    try {
      const raw = await readFile(filePath, "utf8");
      return parseStore(raw);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
      const seed = createSeedData();
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(seed, null, 2));
      return seed;
    }
  }

  return {
    async read() {
      return ensure();
    },
    update(mutator) {
      const run = async () => {
        const data = await ensure();
        mutator(data);
        await writeFile(filePath, JSON.stringify(data, null, 2));
        return structuredClone(data);
      };
      const next = queue.then(run, run);
      queue = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}

export function parseStore(raw: string): StoreData {
  const parsed = JSON.parse(raw) as Partial<StoreData>;
  if (!parsed || !Array.isArray(parsed.quotes) || !parsed.settings) {
    throw new Error("Het lokale gegevensbestand is ongeldig.");
  }
  return normalizeStore(parsed);
}
