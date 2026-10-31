"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  Megaphone,
  MessageSquarePlus,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { cn } from "cn";

const LINKS = [
  { href: "/", label: "Bericht", icon: MessageSquarePlus },
  { href: "/offertes", label: "Offertes", icon: FileText },
  { href: "/toezicht", label: "Toezicht", icon: ShieldCheck },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/boekhouding", label: "Boekhouding", icon: Wallet },
  { href: "/taken", label: "Taken", icon: ClipboardList },
  { href: "/instellingen", label: "Instellingen", icon: Settings },
];

const DOCK = LINKS.slice(0, 4);
const MORE = LINKS.slice(4);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="hidden max-w-[62vw] items-center gap-1 overflow-x-auto md:flex" aria-label="Hoofdmenu">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((link) => isActive(pathname, link.href));

  return (
    <div className="md:hidden">
      {moreOpen ? (
        <div className="fixed inset-x-3 bottom-20 z-40 rounded-3xl border border-border bg-popover p-2 shadow-lg rise-in">
          <ul className="grid gap-1">
            {MORE.map((link) => {
              const Icon = link.icon;
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl px-3 py-3 text-sm",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link href="/permissies" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-2xl px-3 py-3 text-sm hover:bg-muted">
                Permissies
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
        aria-label="Mobiel menu"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {DOCK.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-label="Meer"
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px]",
                moreOpen || moreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              Meer
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
