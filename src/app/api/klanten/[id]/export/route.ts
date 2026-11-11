import { connection } from "next/server";
import { exportCustomerBundle } from "@/lib/domain/customers";
import { jsonError } from "@/lib/api/http";
import { getRepository } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { id } = await context.params;
  const data = await getRepository().read();
  const bundle = exportCustomerBundle(data, new Date(), id);
  if (!bundle) return jsonError("Deze klant bestaat niet.", 404);
  return Response.json(bundle);
}
