import { connection } from "next/server";
import { getWaitlistAdapter } from "@/lib/waitlist/adapter";
import { clientIp } from "@/lib/waitlist/rate-limit";
import { submitWaitlist } from "@/lib/waitlist/submit";

export async function POST(request: Request) {
  await connection();
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const result = await submitWaitlist(body, {
    adapter: getWaitlistAdapter(),
    ip: clientIp(request),
  });
  return Response.json(result.body, { status: result.status });
}
