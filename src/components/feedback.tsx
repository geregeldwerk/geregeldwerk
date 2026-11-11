import Image from "next/image";
import { Button } from "@/components/ui/button";

export function LoadingNote({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {label}
    </p>
  );
}

export function ErrorNote({
  message,
  issues,
  onRetry,
}: {
  message: string;
  issues?: string[];
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
      <p className="font-medium text-destructive">{message}</p>
      {issues && issues.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-foreground">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
          Opnieuw proberen
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/35 bg-card px-5 py-8">
      <Image src="/brand/icoon-512.png" alt="" width={48} height={48} className="size-12 rounded-2xl" />
      <h2 className="mt-4 font-heading text-xl">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{text}</p>
      <p className="mt-4 text-xs font-semibold tracking-[0.16em] text-primary uppercase">Jij doet het werk, wij doen de rest</p>
    </div>
  );
}
