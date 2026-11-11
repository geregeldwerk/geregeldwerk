import type { StoreData } from "@/lib/domain/types";
import type { BillingInterval, BillingPurchase, CompanySubscription } from "@/lib/billing/types";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export interface StripeEventInput {
  id: string;
  type: string;
  created?: number;
  data: { object: Record<string, unknown> };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function metadataOf(object: Record<string, unknown>): Record<string, string> {
  const raw = object.metadata;
  if (!raw || typeof raw !== "object") return {};
  const entries = Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return Object.fromEntries(entries);
}

function planIdOf(value: string | null): CompanySubscription["planId"] | null {
  if (value === "starter" || value === "professional" || value === "business") return value;
  return null;
}

function intervalOf(value: string | null): BillingInterval | null {
  if (value === "month" || value === "year") return value;
  return null;
}

function unixToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function eventsOf(store: StoreData): string[] {
  store.processedStripeEvents ??= [];
  return store.processedStripeEvents;
}

function purchasesOf(store: StoreData): BillingPurchase[] {
  store.billingPurchases ??= [];
  return store.billingPurchases;
}

function remember(store: StoreData, eventId: string) {
  const events = eventsOf(store);
  if (!events.includes(eventId)) events.push(eventId);
  if (events.length > 500) events.splice(0, events.length - 500);
}

function period(object: Record<string, unknown>): { start: string | null; end: string | null } {
  const items = object.items as { data?: Array<Record<string, unknown>> } | undefined;
  const first = items?.data?.[0];
  return {
    start: unixToIso(object.current_period_start ?? first?.current_period_start),
    end: unixToIso(object.current_period_end ?? first?.current_period_end),
  };
}

function upsertSubscription(store: StoreData, object: Record<string, unknown>, deleted: boolean) {
  const stripeSubscriptionId = text(object.id);
  const stripeCustomerId = text(object.customer);
  if (!stripeSubscriptionId || !stripeCustomerId) return;
  const meta = metadataOf(object);
  const previous = store.subscription?.stripeSubscriptionId === stripeSubscriptionId ? store.subscription : null;
  const planId = planIdOf(meta.planId) ?? previous?.planId ?? null;
  const interval = intervalOf(meta.interval) ?? previous?.interval ?? null;
  if (!planId || !interval) return;
  const window = period(object);
  const next: CompanySubscription = {
    stripeSubscriptionId,
    stripeCustomerId,
    planId,
    interval,
    status: deleted ? "canceled" : text(object.status) ?? previous?.status ?? "incomplete",
    lookupKey: text(meta.lookupKey) ?? previous?.lookupKey ?? null,
    currentPeriodStart: window.start ?? previous?.currentPeriodStart ?? null,
    currentPeriodEnd: window.end ?? previous?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: deleted ? true : object.cancel_at_period_end === true,
    updatedAt: new Date().toISOString(),
  };
  store.subscription = next;
}

function recordPurchase(store: StoreData, object: Record<string, unknown>) {
  if (text(object.mode) !== "payment") return;
  const sessionId = text(object.id);
  const meta = metadataOf(object);
  if (!sessionId || meta.kind !== "addon" || !meta.addonId || !meta.lookupKey) return;
  const purchases = purchasesOf(store);
  if (purchases.some((item) => item.checkoutSessionId === sessionId)) return;
  const purchase: BillingPurchase = {
    checkoutSessionId: sessionId,
    addonId: meta.addonId,
    lookupKey: meta.lookupKey,
    stripeCustomerId: text(object.customer),
    paidAt: new Date().toISOString(),
  };
  purchases.push(purchase);
}

function recordSubscriptionCheckout(store: StoreData, object: Record<string, unknown>) {
  if (text(object.mode) !== "subscription") return;
  const subscriptionId = text(object.subscription);
  const customerId = text(object.customer);
  const meta = metadataOf(object);
  const planId = planIdOf(meta.planId);
  const interval = intervalOf(meta.interval);
  if (!subscriptionId || !customerId || !planId || !interval) return;
  if (store.subscription?.stripeSubscriptionId === subscriptionId && store.subscription.status !== "incomplete") return;
  store.subscription = {
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    planId,
    interval,
    status: text(object.payment_status) === "paid" ? "active" : "incomplete",
    lookupKey: text(meta.lookupKey),
    currentPeriodStart: store.subscription?.currentPeriodStart ?? null,
    currentPeriodEnd: store.subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: false,
    updatedAt: new Date().toISOString(),
  };
}

/** Verwerkt één Stripe-event op de lokale winkel. Tweede keer met hetzelfde id doet niets. */
export function applyStripeEvent(store: StoreData, event: StripeEventInput): { duplicate: boolean; handled: boolean } {
  store.billingPurchases ??= [];
  store.processedStripeEvents ??= [];
  if (store.processedStripeEvents.includes(event.id)) return { duplicate: true, handled: false };
  const handled = HANDLED.has(event.type);
  if (event.type === "checkout.session.completed") {
    recordPurchase(store, event.data.object);
    recordSubscriptionCheckout(store, event.data.object);
  } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    upsertSubscription(store, event.data.object, false);
  } else if (event.type === "customer.subscription.deleted") {
    upsertSubscription(store, event.data.object, true);
  }
  remember(store, event.id);
  return { duplicate: false, handled };
}
