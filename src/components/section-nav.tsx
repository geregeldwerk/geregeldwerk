"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

const LINKS = [
  { href: "/app", label: "Inloggen" },
  { href: "#wachtlijst", label: "Early access" },
  { href: "#waarom", label: "Waarom" },
  { href: "#werking", label: "Zo werkt het" },
  { href: "#prijzen", label: "Prijzen" },
  { href: "#uitbreidingen", label: "Uitbreidingen" },
  { href: "#contact", label: "Contact" },
] as const;

export function SectionNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="border-t border-border lg:hidden">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Menu
        <ChevronDown aria-hidden className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <nav id={menuId} aria-label="Pagina" hidden={!open} className="grid px-2 pb-2">
        {LINKS.map((link) => {
          const className = "flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-muted";
          if (link.href.startsWith("#")) {
            return (
              <a key={link.href} href={link.href} className={className} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            );
          }
          return (
            <Link key={link.href} href={link.href} className={className} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
