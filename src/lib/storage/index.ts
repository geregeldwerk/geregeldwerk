import path from "node:path";
import { createFileRepository, type Repository } from "@/lib/storage/file-repository";

let repository: Repository | null = null;

/**
 * Local JSON file today. A later Supabase implementation can satisfy the same
 * Repository interface without changing the API routes.
 */
export function getRepository(): Repository {
  if (!repository) {
    const file =
      process.env.GEREGELDWERK_DATA_FILE || path.join(process.cwd(), "data", "store.json");
    repository = createFileRepository(file);
  }
  return repository;
}
