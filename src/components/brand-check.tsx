import { cn } from "cn";

export function BrandCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4 shrink-0 text-primary", className)}>
      <path
        fill="currentColor"
        d="M9.4 16.8 4.8 12.1a1.5 1.5 0 0 1 2.2-2.1l2.4 2.5 5.9-6.2a1.5 1.5 0 0 1 2.2 2.1l-7 7.3a1.5 1.5 0 0 1-1.1.5 1.5 1.5 0 0 1-1-.4Z"
      />
    </svg>
  );
}
