import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getViz } from "@/lib/api";
import { first, validHours, type SP } from "@/lib/params";
import type { Viz } from "@/lib/api-types";
import {
  FamilyNetwork3D,
  FamilyTerrain,
  ParticleHero,
  PercentileColumns,
  SizeHistogram3D,
} from "@/components/three";
import { TrendChart } from "@/components/viz/trend-chart";
import { VizCard } from "@/components/viz/viz-card";
import { edgesToBytes, fmtBytes, fmtHour, fmtInt } from "@/components/viz/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Visualización 3D · Bazaar Board",
  description:
    "Terreno 3D familia × hora, histograma de tamaños, percentiles, red de co-ocurrencia y tendencia horaria de malware.",
};

const RANGES = [
  { h: 24, label: "24 horas" },
  { h: 72, label: "3 días" },
  { h: 168, label: "7 días" },
];

/** Ventana por defecto de las escenas 3D (acepta cualquier valor 1–168 que fije setWindow). */
const parseHours = (sp: SP) => validHours(first(sp.hours)) ?? 72;

function insights(v: Viz) {
  const rowTotals = v.family_hour_matrix.map((r) => r.reduce((s, x) => s + x, 0));
  const grand = rowTotals.reduce((s, x) => s + x, 0);
  const lead = rowTotals.reduce((b, x, i) => (x > rowTotals[b] ? i : b), 0);
  const leadRow = v.family_hour_matrix[lead] ?? [];
  const leadPeak = leadRow.reduce((b, x, j) => (x > leadRow[b] ? j : b), 0);
  const terrain = grand
    ? `${v.families[lead]} concentra ${((rowTotals[lead] / grand) * 100).toFixed(1)} % de las ${fmtInt(grand)} muestras del top ${v.families.length}; su hora pico fue ${fmtHour(v.hours[leadPeak] ?? "")} con ${fmtInt(leadRow[leadPeak] ?? 0)} muestras.`
    : "No hay muestras en la ventana seleccionada.";

  const e = edgesToBytes(v.size_histogram.edges);
  const total = v.size_histogram.counts.reduce((s, x) => s + x, 0);
  const mi = v.size_histogram.counts.reduce(
    (b, x, i, a) => (x > a[b] ? i : b),
    0,
  );
  const hist = total
    ? `El intervalo modal es ${fmtBytes(e[mi])} – ${fmtBytes(e[mi + 1])}: ${((v.size_histogram.counts[mi] / total) * 100).toFixed(1)} % de ${fmtInt(total)} muestras. La cola derecha se extiende hasta ${fmtBytes(e[e.length - 1])}.`
    : "No hay tamaños para graficar.";

  const pc = (p: number) => v.percentile_curve.find((c) => c.p === p)?.value;
  const p50 = pc(50);
  const p99 = pc(99);
  const pct =
    p50 && p99
      ? `La mediana (P50) es ${fmtBytes(p50)} pero el P99 llega a ${fmtBytes(p99)}, ${(p99 / p50).toLocaleString("es-MX", { maximumFractionDigits: 1 })} veces mayor: unos pocos archivos son enormes.`
      : "No hay percentiles disponibles.";

  const deg = new Map<string, number>();
  v.family_links.forEach((l) => {
    deg.set(l.source, (deg.get(l.source) ?? 0) + 1);
    deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
  });
  const hub = [...deg.entries()].sort((a, b) => b[1] - a[1])[0];
  const strong = [...v.family_links].sort((a, b) => b.weight - a.weight)[0];
  const net = strong
    ? `La relación más fuerte es ${strong.source} – ${strong.target} (peso ${fmtInt(strong.weight)}). ${hub ? `${hub[0]} es la más conectada, con ${hub[1]} vínculos.` : ""}`
    : "No se detectó co-ocurrencia entre familias.";

  const peak = v.trend.reduce((b, x) => (x.count > b.count ? x : b), v.trend[0]);
  const mean = v.trend.length
    ? v.trend.reduce((s, x) => s + x.count, 0) / v.trend.length
    : 0;
  const trend = peak
    ? `El pico fue ${fmtHour(peak.hour)} con ${fmtInt(peak.count)} muestras, frente a un promedio de ${mean.toLocaleString("es-MX", { maximumFractionDigits: 1 })} por hora.`
    : "No hay serie horaria.";
  return { terrain, hist, pct, net, trend };
}

export default async function VisualizacionPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const hours = parseHours(await searchParams);
  const res = await getViz(hours);
  const viz: Viz | null = res.ok ? res.data : null;
  const error: string | null = res.ok ? null : res.error;
  const ins = viz ? insights(viz) : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6">
      <ParticleHero className="rounded-xl border border-border bg-card/40 px-6 py-8">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Sección 13 · Visualización de datos
        </p>
        <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">
          El malware en tres dimensiones
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Cada escena se calcula con las muestras reales de MalwareBazaar:
          arrastra para girar, pasa el cursor para ver el valor exacto y abre
          la tabla de datos si prefieres leer cifras.
        </p>
        <nav aria-label="Ventana de tiempo" className="mt-4 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.h}
              href={`/visualizacion?hours=${r.h}`}
              aria-current={r.h === hours ? "page" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                r.h === hours
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </ParticleHero>

      {error || !viz || !ins ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle className="text-base">
            No se pudieron cargar las visualizaciones
          </AlertTitle>
          <AlertDescription>
            {error} Verifica que la API esté en marcha y vuelve a intentarlo.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <VizCard
            index={0}
            title="Terreno familia × hora"
            subtitle={`Top ${viz.families.length} familias durante ${viz.hours.length} horas (UTC).`}
            howToRead="Cada columna es una celda: su posición en el eje largo es la hora, en el eje corto la familia, y su altura (raíz del conteo, para que las familias pequeñas no desaparezcan) y color indican cuántas muestras llegaron. Pasa el cursor para ver el número exacto."
            insight={ins.terrain}
          >
            <FamilyTerrain
              families={viz.families}
              hours={viz.hours}
              matrix={viz.family_hour_matrix}
            />
          </VizCard>

          <div className="grid gap-6">
            <VizCard
              index={1}
              title="Histograma 3D del tamaño"
              subtitle="Muestras por intervalo de tamaño de archivo (bins logarítmicos)."
              howToRead="El eje horizontal es el tamaño en escala logarítmica: cada paso multiplica el tamaño, no lo suma. La altura y el color de cada barra son el número de muestras en ese intervalo."
              insight={ins.hist}
            >
              <SizeHistogram3D
                edges={viz.size_histogram.edges}
                counts={viz.size_histogram.counts}
              />
            </VizCard>
            <VizCard
              index={2}
              title="Percentiles del tamaño"
              subtitle="99 columnas en anillo: del percentil 1 al 99."
              howToRead="Cada columna es un percentil; su altura está en escala logarítmica. Un percentil P indica el tamaño por debajo del cual queda el P % de las muestras. Las columnas ámbar marcan P25, P50, P75, P90 y P99."
              insight={ins.pct}
            >
              <PercentileColumns curve={viz.percentile_curve} />
            </VizCard>
          </div>

          <VizCard
            index={3}
            title="Red de co-ocurrencia de familias"
            subtitle="Familias que comparten tipo de archivo y método de entrega."
            howToRead="Cada esfera es una familia (más grande = más muestras) y el color indica su grupo. Una línea une dos familias que aparecen con el mismo tipo de archivo o método de entrega; cuanto más clara, mayor el peso. Pasa el cursor sobre una esfera para resaltar sus vínculos."
            insight={ins.net}
          >
            <FamilyNetwork3D nodes={viz.family_nodes} links={viz.family_links} />
          </VizCard>

          <VizCard
            index={4}
            title="Tendencia por hora"
            subtitle="Muestras por hora y su media móvil de 3 horas."
            howToRead="Las barras son el conteo de cada hora; la línea ámbar promedia la hora y las dos anteriores para suavizar el ruido y mostrar la tendencia de fondo."
            insight={ins.trend}
          >
            <TrendChart data={viz.trend} />
          </VizCard>
        </>
      )}
    </main>
  );
}
