import { RefreshCw } from "lucide-react";
import { refreshData, setWindow } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RANGES } from "@/lib/params";
import { cn } from "@/lib/utils";

/**
 * Selector de ventana + actualizar datos. Son formularios con server actions,
 * así que funcionan sin JavaScript.
 */
export function WindowControls({
  path,
  hours,
}: {
  path: string;
  hours: number;
}) {
  const preset = RANGES.some((r) => r.h === hours);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        action={setWindow}
        role="group"
        aria-label="Ventana de tiempo"
        className="inline-flex rounded-lg border border-border bg-card p-0.5"
      >
        <input type="hidden" name="path" value={path} />
        {RANGES.map((r) => (
          <button
            key={r.h}
            type="submit"
            name="hours"
            value={r.h}
            aria-pressed={r.h === hours}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              r.h === hours
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </form>
      <form action={setWindow} className="flex items-center gap-1.5">
        <input type="hidden" name="path" value={path} />
        <label className="sr-only" htmlFor={`h-${path}`}>
          Horas personalizadas (1 a 168)
        </label>
        <Input
          id={`h-${path}`}
          name="hours"
          type="number"
          inputMode="numeric"
          min={1}
          max={168}
          step={1}
          required
          defaultValue={preset ? "" : hours}
          placeholder="1–168 h"
          className="w-24"
        />
        <Button type="submit" variant="outline">
          Aplicar
        </Button>
      </form>
      <form action={refreshData} className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" name="snapshot" className="accent-[var(--primary)]" />
          guardar copia offline
        </label>
        <Button type="submit" variant="outline">
          <RefreshCw className="size-4" aria-hidden />
          Actualizar datos
        </Button>
      </form>
    </div>
  );
}

export function PageHeader({
  title,
  lead,
  path,
  hours,
  extra,
}: {
  title: string;
  lead: string;
  path: string;
  hours: number;
  extra?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{lead}</p>
      </div>
      <div className="flex flex-col items-start gap-2 lg:items-end">
        <WindowControls path={path} hours={hours} />
        {extra}
      </div>
    </header>
  );
}
