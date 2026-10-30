"use client";

import { Button } from "@/components/ui/button";

export default function WorkError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-6">
      <h1 className="font-heading text-2xl">Er ging iets mis</h1>
      <p className="mt-2 text-sm">{error.message}</p>
      <Button type="button" className="mt-4 h-10" onClick={reset}>
        Opnieuw proberen
      </Button>
    </div>
  );
}
