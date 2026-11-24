import { AlertTriangle, Lightbulb, Link2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Región titulada del reporte: un panel, sin tarjetas anidadas. */
export function Panel({
  id,
  title,
  topic,
  hint,
  children,
  className,
  index = 0,
}: {
  id?: string;
  title: string;
  /** Número del tema del temario (p. ej. "Tema 6"). */
  topic?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        "rise scroll-mt-20 rounded-xl border border-border bg-card p-5",
        className,
      )}
      style={{ "--i": index } as React.CSSProperties}
    >
      {topic && (
        <p className="font-heading text-sm font-semibold uppercase tracking-widest text-primary">
          {topic}
        </p>
      )}
      <h2 id={id ? `${id}-title` : undefined} className="text-2xl font-semibold">
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Bloque fijo de cada sección: conecta la teoría con el problema de malware. */
export function Relation({
  children,
  title = "Cómo se relaciona con el problema",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <aside className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <h3 className="flex items-center gap-2 font-heading text-lg font-semibold text-primary">
        <Link2 className="size-4" aria-hidden />
        {title}
      </h3>
      <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </aside>
  );
}

/** Interpretación en lenguaje claro de un número o gráfica. */
export function Insight({
  children,
  title = "Qué significa",
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed",
        className,
      )}
    >
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div>
        <span className="font-medium text-foreground">{title}: </span>
        <span className="text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3.5 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-semibold leading-none tabular-nums">
        {value}
      </dd>
      {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function ApiError({ error }: { error: string }) {
  return (
    <Alert variant="destructive" className="mt-8">
      <AlertTriangle />
      <AlertTitle>No se pudieron cargar los datos</AlertTitle>
      <AlertDescription>
        {error} Cuando la API vuelva a responder, recarga la página o usa
        “Actualizar datos”.
      </AlertDescription>
    </Alert>
  );
}

export function EmptyData() {
  return (
    <p className="mt-8 text-muted-foreground">
      No hay muestras en esta ventana. Prueba con un rango mayor.
    </p>
  );
}

/** Esqueleto común para los loading.tsx de cada ruta. */
export function PageSkeleton({ message }: { message?: string }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8" aria-busy="true">
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="mt-3 h-5 w-[28rem] max-w-full" />
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="mt-6 h-64" />
      <p role="status" className="mt-6 text-sm text-muted-foreground">
        {message ?? "Consultando la API y calculando el modelo…"}
      </p>
    </main>
  );
}
