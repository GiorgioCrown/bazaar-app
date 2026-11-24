import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/** Panel de una visualización: título, gráfica, cómo leerla e insight del dato. */
export function VizCard({
  title,
  subtitle,
  howToRead,
  insight,
  children,
  className,
  index = 0,
}: {
  title: string;
  subtitle: string;
  howToRead: string;
  insight: ReactNode;
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <section
      className={cn("rise rounded-xl border border-border bg-card p-5", className)}
      style={{ "--i": index } as React.CSSProperties}
    >
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4">{children}</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-muted/50 p-3">
          <h3 className="text-base font-semibold">Cómo leer esta gráfica</h3>
          <p className="mt-1 text-sm text-muted-foreground">{howToRead}</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-primary">
            <Lightbulb className="size-4" aria-hidden />
            Lo que dicen los datos
          </h3>
          <p className="mt-1 text-sm">{insight}</p>
        </div>
      </div>
    </section>
  );
}
