import { connection } from "next/server";
import { getRepository } from "@/lib/storage";

export async function GET() {
  await connection();
  const data = await getRepository().read();
  return Response.json({
    invoices: data.invoices,
    expenses: data.expenses,
    appointments: data.appointments,
  });
}
