import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type QuoteStatus } from "@/lib/domain/types";

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const variant = status === "geaccepteerd" ? "default" : status === "verstuurd" ? "outline" : "secondary";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
}

export function ExampleBadge() {
  return <Badge variant="outline">Voorbeeld</Badge>;
}
