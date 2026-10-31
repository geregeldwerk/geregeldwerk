import { Suspense } from "react";
import { QuotePageClient } from "@/components/quote-page-client";

export default function QuotePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Offerte laden…</p>}>
      <QuotePageClient />
    </Suspense>
  );
}
