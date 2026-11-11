import { connection } from "next/server";
import { getStripe, STRIPE_NOT_CONFIGURED } from "@/lib/billing/stripe";
import { getRepository } from "@/lib/storage";

export async function POST(request: Request) {
  await connection();
  const stripe = getStripe();
  if (!stripe) return Response.json({ error: STRIPE_NOT_CONFIGURED }, { status: 503 });
  const data = await getRepository().read();
  const customerId = data.subscription?.stripeCustomerId;
  if (!customerId) {
    return Response.json({ error: "Er is nog geen abonnement om te beheren." }, { status: 409 });
  }
  try {
    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/instellingen`,
    });
    return Response.json({ url: session.url });
  } catch {
    console.error("Stripe-portal mislukt");
    return Response.json({ error: "Het klantportaal van Stripe is nu niet bereikbaar." }, { status: 502 });
  }
}
