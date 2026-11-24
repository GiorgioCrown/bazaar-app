"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FamilyStat } from "@/lib/api-types";

export type Row = FamilyStat;

type Key = "family" | "count";

const COLS: { key: Key; label: string; align?: "right" }[] = [
  { key: "family", label: "Familia" },
  { key: "count", label: "Frecuencia nᵢ · Probabilidad p = nᵢ/N", align: "right" },
];

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)} %`;

export function FamilyTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [key, setKey] = useState<Key>("count");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [limit, setLimit] = useState(15);

  const view = useMemo(() => {
    const f = rows.filter((r) =>
      r.family.toLowerCase().includes(q.trim().toLowerCase()),
    );
    return f.sort((a, b) => {
      const c =
        key === "family" ? a.family.localeCompare(b.family) : a.count - b.count;
      return c * dir;
    });
  }, [rows, q, key, dir]);

  const maxP = Math.max(...rows.map((r) => r.p), 0.0001);

  function sortBy(k: Key) {
    if (k === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setKey(k);
      setDir(k === "family" ? 1 : -1);
    }
  }

  return (
    <div>
      <div className="relative mb-3 max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar familia…"
          aria-label="Filtrar familia"
          className="pl-8"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {COLS.map((c) => {
                const active = c.key === key;
                const Icon = !active
                  ? ChevronsUpDown
                  : dir === 1
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <TableHead
                    key={c.key}
                    aria-sort={
                      active ? (dir === 1 ? "ascending" : "descending") : "none"
                    }
                    className={cn(c.align === "right" && "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => sortBy(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm font-medium transition-colors hover:text-foreground",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {c.label}
                      <Icon className="size-3.5" aria-hidden />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.slice(0, limit).map((r) => (
              <TableRow key={r.family}>
                <TableCell className="font-medium">{r.family}</TableCell>
                <TableCell>
                  <div className="ml-auto flex w-64 items-center gap-3">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(r.p / maxP) * 100}%` }}
                      />
                    </div>
                    <span className="w-36 text-right tabular-nums">
                      {r.count.toLocaleString("es-MX")} · {pct(r.p)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {view.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLS.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  Ninguna familia coincide con “{q}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {view.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 25)}
          className="mt-3 text-sm text-primary underline-offset-4 hover:underline"
        >
          Mostrar más ({view.length - limit} restantes)
        </button>
      )}
    </div>
  );
}
