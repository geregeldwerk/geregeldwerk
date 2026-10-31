import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type QuoteStatus } from "@/lib/domain/types";

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const className =
    status === "geaccepteerd"
      ? "border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "verstuurd"
        ? "border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
        : "border-amber-200 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  return <Badge variant="outline" className={className}>{STATUS_LABEL[status]}</Badge>;
}

export function ExampleBadge() {
  return <Badge variant="outline">Voorbeeld</Badge>;
}
