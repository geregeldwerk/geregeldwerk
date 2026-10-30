"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";

export function EmergencyBanner() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    void api<{ emergencyStop: boolean }>("/api/toezicht")
      .then((data) => setPaused(data.emergencyStop))
      .catch(() => setPaused(false));
  }, []);

  if (!paused) return null;

  return (
    <p className="bg-destructive px-4 py-2 text-center text-sm text-white">
      Noodstop aan. Automatische permissies zijn gepauzeerd; acties binnen de grenzen gaan naar de wachtrij.{" "}
      <Link href="/toezicht" className="underline">
        Naar Toezicht
      </Link>
    </p>
  );
}
