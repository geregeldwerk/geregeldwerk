"use client";

import { Button } from "@/components/ui/button";

export default function WorkError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-3xl border border-destructive/30 bg-destructive/10 px-5 py-8">
      <h1 className="font-heading text-2xl">Er ging iets mis</h1>
      <p className="mt-2 max-w-xl text-sm leading-6">{error.message}</p>
      <Button type="button" className="mt-5 h-11 px-4" onClick={reset}>
        Opnieuw proberen
      </Button>
    </div>
  );
}
