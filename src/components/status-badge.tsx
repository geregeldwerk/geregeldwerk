import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type QuoteStatus } from "@/lib/domain/types";

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant="outline" data-status={status} className="status-badge">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function ExampleBadge() {
  return <Badge variant="outline">Voorbeeld</Badge>;
}
