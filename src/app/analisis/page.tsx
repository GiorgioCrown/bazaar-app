import { AlertTriangle, CheckCircle2, Download, Info } from "lucide-react";
import { getFamilies, getOverview } from "@/lib/api";
import type { Families, Overview } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { num, pct } from "@/lib/format";
import { FlapNumber } from "@/components/flap-number";
import { FamilyBars, HourlyChart } from "@/components/charts";
import { FamilyTable } from "@/components/family-table";
import { PageHeader } from "@/components/window-controls";
import { ApiError, EmptyData, Insight, Panel, Relation } from "@/components/section";
import { TopicGrid } from "@/components/topic-grid";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function Board({ o, f }: { o: Overview; f: Families }) {
  const rows = [
    {
      label: "Muestras descargadas",
      value: num(o.total),
      note: `${num(o.classified)} con familia · ${num(o.unclassified)} sin firma`,
    },
    {
      label: "Familias distintas",
      value: String(o.distinct_families),
      note: `El top 5 reúne ${pct(f.top5_share)}`,
    },
    {
      label: "Llegada global λ",
      value: o.lambda_total.toFixed(1),
      unit: "/h",
      note: `Ventana observada de ${o.window_hours_observed.toFixed(0)} h`,
    },
    {
      label: "Entropía de Shannon",
      value: f.entropy.toFixed(2),
      unit: "bits",
      note: `Uniformidad ${f.entropy_norm.toFixed(2)} de 1 · Gini-Simpson ${f.gini_simpson.toFixed(2)}`,
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

function Reading({ f }: { f: Families }) {
  const top = f.families[0];
  const d = f.dispersion;
  const concentration =
    f.entropy_norm < 0.45 ? "alta" : f.entropy_norm < 0.7 ? "media" : "baja";
  return (
    <div className="space-y-3">
      {top && (
        <Alert>
          <Info />
          <AlertTitle className="text-base">{top.family} domina la muestra</AlertTitle>
          <AlertDescription>
            Representa {pct(top.p)} de las muestras clasificadas (IC 95 % {pct(top.ci_low)}–
            {pct(top.ci_high)}). Si llega una muestra nueva, hay {pct(top.p)} de probabilidad de
            que sea {top.family}. La concentración es {concentration}: el top 5 suma{" "}
            {pct(f.top5_share)}.
          </AlertDescription>
        </Alert>
      )}
      {d &&
        (d.p_value > 0.05 ? (
          <Alert>
            <CheckCircle2 />
            <AlertTitle className="text-base">Las llegadas se ajustan a Poisson</AlertTitle>
            <AlertDescription>
              Índice de dispersión {d.index.toFixed(2)} (p ≈ {d.p_value.toFixed(3)}): no hay
              evidencia contra el modelo.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-primary/40 bg-primary/5">
            <AlertTriangle className="text-primary" />
            <AlertTitle className="text-base text-primary">
              Poisson simple no alcanza: llegan en ráfagas
            </AlertTitle>
            <AlertDescription>
              Índice de dispersión {d.index.toFixed(1)} (χ² = {d.chi2.toFixed(0)}, gl = {d.df}, p{" "}
              {d.p_value < 0.001 ? "< 0.001" : `≈ ${d.p_value.toFixed(3)}`}).{" "}
              {d.index > 1
                ? "Hay sobredispersión, así que las probabilidades de “al menos una aparición” son optimistas: con ráfagas hay más horas vacías de las que prevé Poisson, así que la probabilidad real de ver al menos una suele ser algo menor."
                : "Hay subdispersión: las llegadas son más regulares que Poisson."}
            </AlertDescription>
          </Alert>
        ))}
    </div>
  );
}

function Report({ o, f, hours }: { o: Overview; f: Families; hours: number }) {
  const top = f.families.slice(0, 10);
  const rest = f.families.slice(10);
  const restCount = rest.reduce((s, x) => s + x.count, 0);
  const bars = [
    ...top.map((x) => ({ family: x.family, count: x.count, p: x.p })),
    ...(rest.length
      ? [{ family: `Otras (${rest.length})`, count: restCount, p: restCount / o.classified }]
      : []),
  ];

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Board o={o} f={f} />
        <Panel
          index={1}
          title="Distribución por familia"
          hint={`P(familia) = muestras de la familia ÷ ${num(o.classified)} clasificadas. Datos del ${o.window_start} al ${o.window_end} UTC.`}
        >
          <FamilyBars data={bars} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Panel index={2} title="Lectura del modelo" hint="Qué dicen los números, sin jerga.">
          <Reading f={f} />
        </Panel>
        <Panel
          index={3}
          title="Patrón temporal"
          hint="Muestras nuevas por hora (UTC). Los picos explican la sobredispersión."
        >
          <HourlyChart data={f.hourly} />
        </Panel>
      </div>

      <Panel
        index={4}
        title="Modelo de aparición por familia"
        hint="Multinomial para “¿de qué familia será la próxima muestra?” y Poisson para “¿aparecerá al menos una en t horas?”. Ordena o filtra con la tabla."
      >
        <FamilyTable rows={f.families} />
        <div className="mt-4">
          <Insight>
            P(≥1 en t h) = 1 − e<sup>−λt</sup> es la probabilidad de ver al menos una muestra nueva
            de esa familia en las próximas t horas. Cerca de 100 % significa que la familia es casi
            segura de aparecer; cerca de 0 %, que es rara.
          </Insight>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel index={5} title="Cómo se calcula">
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <b className="text-foreground">Multinomial:</b> pᵢ = nᵢ / N, con intervalo de Wilson al 95 %.
            </li>
            <li>
              <b className="text-foreground">Poisson:</b> λᵢ = nᵢ / T muestras por hora; P(≥1 en t h) = 1 −
              e<sup>−λᵢ·t</sup>.
            </li>
            <li>
              <b className="text-foreground">Prueba de dispersión:</b> χ² = Σ(xₕ − x̄)² / x̄ sobre los
              conteos por hora; si p &lt; 0.05 se rechaza Poisson simple.
            </li>
            <li>
              <b className="text-foreground">Diversidad:</b> entropía de Shannon H = −Σ pᵢ log₂ pᵢ e índice
              de Gini-Simpson.
            </li>
          </ul>
        </Panel>
        <Panel index={6} title="Tipos de archivo">
          <div className="flex flex-wrap gap-2">
            {f.file_types.slice(0, 12).map((t) => (
              <Badge key={t.type} variant="secondary" className="h-7 px-2.5 text-sm">
                {t.type}
                <span className="ml-1.5 text-muted-foreground">{pct(t.p)}</span>
              </Badge>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            Ventana pedida: {hours} h; observada: {o.window_hours_observed.toFixed(0)} h. La API puede
            acotar los registros, por eso las tasas usan la ventana realmente observada.
            {o.enriched != null &&
              ` Los temas de tamaño, tipo de archivo, tags y ClamAV usan las ${num(o.enriched)} muestras con metadatos completos (${pct(o.enriched_fraction)} del total).`}
            {o.offline && " Los datos provienen de una copia guardada (modo offline)."}
          </p>
        </Panel>
      </div>

      <Panel index={7} title="Del conteo a la probabilidad">
        <Relation>
          <p>
            El problema pide un modelo de probabilidad de aparición del malware. Aquí cada muestra es un
            ensayo: la familia sigue una distribución multinomial (¿cuál será la próxima?) y las
            llegadas por hora un proceso de Poisson (¿cuántas llegarán?). Los temas siguientes
            profundizan cada ingrediente.
          </p>
        </Relation>
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
        title="Análisis probabilístico de malware"
        lead="Registros reales de MalwareBazaar, clasificados por familia, con su distribución estadística y un modelo de probabilidad de aparición."
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
      {o.ok && f.ok && (o.data.total === 0 ? <EmptyData /> : <Report o={o.data} f={f.data} hours={hours} />)}
    </main>
  );
}
