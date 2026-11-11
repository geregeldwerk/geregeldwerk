import { connection } from "next/server";
import { applyStripeEvent, type StripeEventInput } from "@/lib/billing/events";
import { getStripe, webhookSecret } from "@/lib/billing/stripe";
import { getRepository } from "@/lib/storage";

export async function POST(request: Request) {
  await connection();
  const stripe = getStripe();
  const secret = webhookSecret();
  if (!stripe || !secret) {
    return Response.json({ error: "De Stripe-webhook is nog niet geconfigureerd." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Ongeldige Stripe-handtekening." }, { status: 400 });
  const payload = await request.text();
  let event: StripeEventInput;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret) as unknown as StripeEventInput;
  } catch {
    return Response.json({ error: "Ongeldige Stripe-handtekening." }, { status: 400 });
  }
  await getRepository().update((data) => {
    applyStripeEvent(data, event);
  });
  return Response.json({ received: true });
}
