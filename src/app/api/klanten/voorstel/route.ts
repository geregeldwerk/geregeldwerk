import { connection } from "next/server";
import { fromUnknownError, readJson } from "@/lib/api/http";
import { suggestCustomers } from "@/lib/domain/customers";
import { getRepository } from "@/lib/storage";

export async function POST(request: Request) {
  await connection();
  try {
    const body = await readJson(request);
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const data = await getRepository().read();
    const matches = suggestCustomers(data.customers, {
      name: typeof record.name === "string" ? record.name : "",
      email: typeof record.email === "string" ? record.email : "",
      phone: typeof record.phone === "string" ? record.phone : "",
    });
    return Response.json({ matches });
  } catch (error) {
    return fromUnknownError(error);
  }
}
