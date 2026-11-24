import { Download } from "lucide-react";
import { getFamilies, getOverview } from "@/lib/api";
import type { Families, Overview } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { num, pct } from "@/lib/format";
import { FlapNumber } from "@/components/flap-number";
import { FamilyBars, HourlyChart } from "@/components/charts";
import { FamilyTable } from "@/components/family-table";
import { PageHeader } from "@/components/window-controls";
import { ApiError, EmptyData, Expose, Insight, Panel, Relation } from "@/components/section";
import { TopicGrid } from "@/components/topic-grid";
import { buttonVariants } from "@/components/ui/button";

function Board({ o, f }: { o: Overview; f: Families }) {
  const rows = [
    {
      label: "Muestras",
      value: num(o.total),
      note: `${num(o.classified)} con familia · ${num(o.unclassified)} sin familia`,
    },
    {
      label: "Familias distintas",
      value: String(o.distinct_families),
      note: `Las 5 más grandes reúnen ${pct(f.top5_share)}`,
    },
    {
      label: "Promedio por hora",
      value: o.avg_per_hour.toFixed(1),
      unit: "muestras/h",
      note: `En ${o.window_hours_observed.toFixed(0)} horas observadas`,
    },
  ];
  return (
    <section aria-label="Resumen" className="rise rounded-xl border border-border bg-card">
      <dl className="flex h-full flex-col divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-1 items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <dt className="text-sm font-medium text-muted-foreground">{r.label}</dt>
              <dd className="mt-0.5 text-xs text-muted-foreground/80">{r.note}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <FlapNumber value={r.value} className="text-4xl" />
              {r.unit && <span className="text-sm text-muted-foreground">{r.unit}</span>}
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Report({ o, f }: { o: Overview; f: Families }) {
  const top = f.families[0];
  const shown = f.families.slice(0, 10);
  const rest = f.families.slice(10);
  const restCount = rest.reduce((s, x) => s + x.count, 0);
  const bars = [
    ...shown.map((x) => ({ family: x.family, count: x.count, p: x.p })),
    ...(rest.length
      ? [{ family: `Otras (${rest.length})`, count: restCount, p: restCount / o.classified }]
      : []),
  ];
  const peak = f.hourly.reduce((m, h) => (h.count > m.count ? h : m), f.hourly[0]);
  const low = f.hourly.reduce((m, h) => (h.count < m.count ? h : m), f.hourly[0]);
  const per100 = (p: number) => Math.round(p * 100);

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Board o={o} f={f} />
        <Panel
          index={1}
          title="Frecuencia por familia"
          hint={`Barras: cuántas muestras hay de cada familia (de ${num(o.classified)} con familia). Datos del ${o.window_start} al ${o.window_end} UTC.`}
        >
          <FamilyBars data={bars} />
        </Panel>
      </div>

      <Panel
        index={2}
        title="Tabla de frecuencias"
        hint="Frecuencia nᵢ = muestras de la familia. Probabilidad p = nᵢ / N, con N = muestras con familia."
      >
        <FamilyTable rows={f.families} />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Insight>
            {top
              ? `De cada 100 muestras, ${per100(top.p)} son ${top.family}. Si sacamos una muestra al azar, la probabilidad de que sea ${top.family} es ${pct(top.p)}.`
              : "No hay familias para mostrar."}{" "}
            Todas las p suman 1.
          </Insight>
          <Relation>
            <p>
              El problema pide la distribución de las familias. Esta tabla es esa distribución: cada p
              es la probabilidad de que una muestra nueva sea de esa familia.
            </p>
          </Relation>
        </div>
      </Panel>

      <Panel index={3} title="Tendencia por hora" hint="Muestras nuevas en cada hora (UTC).">
        <HourlyChart data={f.hourly} />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Insight>
            {peak
              ? `La hora con más muestras fue ${peak.hour} UTC (${num(peak.count)}). La más tranquila tuvo ${num(low.count)}. En promedio llegan ${o.avg_per_hour.toFixed(1)} por hora.`
              : "No hay horas para mostrar."}
          </Insight>
          <Relation>
            <p>
              Muestra cuándo llegan los datos. Si las barras cambian mucho, el promedio por hora solo
              es una referencia.
            </p>
          </Relation>
        </div>
      </Panel>

      <Panel index={4} title="Para exponer">
        <Expose
          items={[
            top
              ? `La familia más frecuente es ${top.family}: ${per100(top.p)} de cada 100 muestras.`
              : "No hay familias en esta ventana.",
            `Hay ${o.distinct_families} familias; las 5 más grandes suman ${pct(f.top5_share)}.`,
            `Llegan ${o.avg_per_hour.toFixed(1)} muestras por hora en promedio.`,
          ]}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Los temas de tamaño, tipo de archivo, tags y ClamAV usan las {num(o.enriched)} muestras con
          datos completos ({pct(o.enriched_fraction)} del total).
          {o.offline && " Los datos vienen de una copia guardada (modo offline)."}
        </p>
        <h3 className="mb-3 mt-6 font-heading text-xl font-semibold">Recorrido por los temas</h3>
        <TopicGrid />
      </Panel>
    </div>
  );
}

export default async function Analisis({ searchParams }: { searchParams: Promise<SP> }) {
  const hours = parseHours(await searchParams);
  const [o, f] = await Promise.all([getOverview(hours), getFamilies(hours)]);
  const error = !o.ok ? o.error : !f.ok ? f.error : null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        title="Análisis de malware por familia"
        lead="Registros reales de MalwareBazaar: cuántas muestras hay de cada familia y qué tan seguido llegan."
        path="/analisis"
        hours={hours}
        extra={
          o.ok &&
          f.ok && (
            <a href={`/analisis/csv?hours=${hours}`} className={buttonVariants({ variant: "outline" })}>
              <Download className="size-4" aria-hidden />
              Descargar CSV
            </a>
          )
        }
      />
      {error && <ApiError error={error} />}
      {o.ok && f.ok && (o.data.total === 0 ? <EmptyData /> : <Report o={o.data} f={f.data} />)}
    </main>
  );
}
