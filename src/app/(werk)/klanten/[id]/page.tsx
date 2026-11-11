import { Suspense } from "react";
import { LoadingNote } from "@/components/feedback";
import { CustomerDetail } from "@/app/(werk)/klanten/[id]/customer-detail";

export default function CustomerPage() {
  return (
    <Suspense fallback={<LoadingNote label="Klant laden…" />}>
      <CustomerDetail />
    </Suspense>
  );
}
