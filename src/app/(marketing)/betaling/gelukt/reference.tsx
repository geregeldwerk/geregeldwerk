"use client";

import { useSearchParams } from "next/navigation";

export function PaymentReference() {
  const reference = useSearchParams().get("session_id")?.trim();
  if (!reference) return null;
  return <p className="mt-3 text-sm text-muted-foreground">Kenmerk: {reference}</p>;
}
