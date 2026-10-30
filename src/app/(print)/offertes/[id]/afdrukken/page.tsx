import { Suspense } from "react";
import { PrintQuoteClient } from "@/components/print-quote-client";

async function PrintQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintQuoteClient id={id} />;
}

export default function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-6 text-sm">Offerte laden…</p>}>
      <PrintQuote params={params} />
    </Suspense>
  );
}
