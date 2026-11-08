"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { reportPageView } from "@/lib/visit";

/** Meldt één paginaweergave, ook na client-side navigatie. Rendert niets. */
export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    try {
      reportPageView(pathname);
    } catch {
      return;
    }
  }, [pathname]);

  return null;
}
