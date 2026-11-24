"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/analisis", label: "Análisis", icon: Activity },
  { href: "/explorador", label: "Explorador", icon: Search },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4">
        <Link href="/analisis" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-sm bg-primary font-heading text-lg font-bold leading-none text-primary-foreground"
          >
            B
          </span>
          <span className="font-heading text-xl font-semibold tracking-wide">
            Bazaar Board
          </span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          Fuente: MalwareBazaar · abuse.ch
        </span>
      </div>
    </header>
  );
}
