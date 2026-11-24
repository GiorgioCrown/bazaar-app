"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Box,
  Brain,
  Dices,
  Menu,
  Percent,
  Search,
  Sigma,
  Waves,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/analisis", label: "Análisis", icon: Activity },
  { href: "/combinatoria", label: "Combinatoria", icon: Dices },
  { href: "/estadistica", label: "Estadística", icon: BarChart3 },
  { href: "/probabilidad", label: "Probabilidad", icon: Percent },
  { href: "/bayes", label: "Bayes", icon: Brain },
  { href: "/variables", label: "Variables", icon: Sigma },
  { href: "/visualizacion", label: "Visualización 3D", icon: Box },
  { href: "/explorador", label: "Explorador", icon: Search },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
        <Link
          href="/analisis"
          className="flex shrink-0 items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
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

        <nav
          aria-label="Principal"
          className="hidden min-w-0 flex-1 items-center gap-0.5 xl:flex"
        >
          {NAV.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={pathname.startsWith(href)}
            />
          ))}
        </nav>

        <span className="ml-auto hidden text-xs text-muted-foreground 2xl:inline">
          MalwareBazaar · abuse.ch
        </span>
        <button
          type="button"
          className="ml-auto grid size-9 place-items-center rounded-md border border-border xl:hidden"
          aria-expanded={open}
          aria-controls="menu-movil"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav
          id="menu-movil"
          aria-label="Principal (móvil)"
          className="border-t border-border bg-background xl:hidden"
        >
          <ul className="mx-auto grid max-w-7xl gap-1 p-3 sm:grid-cols-2">
            {NAV.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <NavLink
                  href={href}
                  label={label}
                  Icon={Icon}
                  active={pathname.startsWith(href)}
                  onNavigate={() => setOpen(false)}
                  block
                />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

function NavLink({
  href,
  label,
  Icon,
  active,
  block,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: typeof Waves;
  active: boolean;
  block?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        block && "py-2.5",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
