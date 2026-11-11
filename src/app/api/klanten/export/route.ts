import { connection } from "next/server";
import { exportCustomerBundle } from "@/lib/domain/customers";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  const bundle = exportCustomerBundle(data, new Date());
  return Response.json(bundle);
}
