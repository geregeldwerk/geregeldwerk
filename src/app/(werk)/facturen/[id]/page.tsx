import { Suspense } from "react";
import { InvoicePageClient } from "@/components/invoice-page-client";

export default function InvoicePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Factuur laden…</p>}>
      <InvoicePageClient />
    </Suspense>
  );
}
