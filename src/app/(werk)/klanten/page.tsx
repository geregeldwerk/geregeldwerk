import { Suspense } from "react";
import { LoadingNote } from "@/components/feedback";
import { CustomersClient } from "@/app/(werk)/klanten/customers-client";

export default function CustomersPage() {
  return (
    <Suspense fallback={<LoadingNote label="Klanten laden…" />}>
      <CustomersClient />
    </Suspense>
  );
}
