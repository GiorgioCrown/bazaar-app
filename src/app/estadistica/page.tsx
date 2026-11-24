import { getDescriptive, getPositions } from "@/lib/api";
import type { DescVar, PositionVar } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { bytes, num } from "@/lib/format";
import { PageHeader } from "@/components/window-controls";
import { ApiError, Insight, Panel, Relation, Stat } from "@/components/section";
import { Boxplot } from "@/components/boxplot";
import { HistogramChart, PercentileChart } from "@/components/stat-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Estadística descriptiva y posición · Bazaar Board" };

const fmtFor = (unit: string) => (v: number | null | undefined) =>
  v == null ? "—" : unit === "bytes" ? bytes(v) : num(v, Math.abs(v) >= 100 ? 1 : 2);

const WHAT: Record<string, string> = {
  file_size: "el tamaño de un archivo malicioso",
  hourly_count: "cuántas muestras llegan en una hora",
  family_count: "cuántas muestras tiene una familia",
  n_tags: "cuántas etiquetas (tags) lleva una muestra",
};

function describe(v: DescVar) {
  const f = fmtFor(v.unit);
  const skew = v.skewness ?? 0;
  const shape =
    skew > 0.5
      ? "sesgada a la derecha: la mayoría de los valores es pequeña y unos pocos muy grandes jalan la media hacia arriba"
      : skew < -0.5
        ? "sesgada a la izquierda: unos pocos valores muy pequeños jalan la media hacia abajo"
        : "aproximadamente simétrica";
  const gap =
    v.median > 0 ? v.mean / v.median : null;
  const modeTxt = v.modes.length
    ? `El valor más repetido (moda) es ${v.modes.slice(0, 3).map(f).join(", ")}${v.modes.length > 3 ? "…" : ""}, ${v.mode_count} veces.`
    : "";
  return (
    <>
      Para {WHAT[v.key] ?? v.label}, la media es {f(v.mean)} y la mediana {f(v.median)}
      {gap && Math.abs(gap - 1) > 0.15
        ? ` (la media es ${gap > 1 ? `${gap.toFixed(1)} veces la mediana` : "menor que la mediana"})`
        : ""}
      . La distribución es {shape}. {modeTxt} La desviación estándar de {f(v.std)} indica
      {v.cv != null ? ` una dispersión relativa (CV) de ${num(v.cv * 100, 0)} %` : " la dispersión típica"}
      {v.outliers.count > 0
        ? `; ${num(v.outliers.count)} valores caen fuera de las cercas del rango intercuartílico (atípicos).`
        : "; no hay atípicos según el criterio del rango intercuartílico."}
    </>
  );
}

function Descriptive({ v, i }: { v: DescVar; i: number }) {
  const f = fmtFor(v.unit);
  return (
    <Panel
      id={`desc-${v.key}`}
      index={i}
      title={v.label}
      hint={`${v.kind === "discrete" ? "Variable discreta" : "Variable continua"} · n = ${num(v.n)}${v.unit ? ` · unidad: ${v.unit}` : ""}`}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Media x̄" value={f(v.mean)} />
          <Stat label="Mediana" value={f(v.median)} />
          <Stat
            label="Moda"
            value={v.modes.length ? f(v.modes[0]) : "—"}
            note={v.modes.length > 1 ? `y ${v.modes.length - 1} más empatadas` : `${v.mode_count} veces`}
          />
          <Stat label="Desv. estándar s" value={f(v.std)} note="muestral (n − 1)" />
          <Stat label="Varianza s²" value={v.unit === "bytes" ? v.variance.toExponential(2) : num(v.variance, 2)} />
          <Stat label="CV" value={v.cv != null ? `${num(v.cv * 100, 0)} %` : "—"} note="s / media" />
          <Stat label="Mínimo" value={f(v.min)} />
          <Stat label="Máximo" value={f(v.max)} />
          <Stat label="Rango" value={f(v.range)} />
          <Stat label="Asimetría" value={v.skewness != null ? num(v.skewness, 2) : "—"} note="> 0: cola derecha" />
          <Stat label="Curtosis" value={v.kurtosis != null ? num(v.kurtosis, 2) : "—"} note="exceso; 0 ≈ normal" />
          <Stat label="Atípicos (IQR)" value={num(v.outliers.count)} note={`cercas ${f(Math.max(v.outliers.fence_low, v.min))} – ${f(v.outliers.fence_high)}`} />
        </dl>
        <div>
          <h3 className="mb-1 font-heading text-lg font-semibold">
            Histograma{v.histogram.scale === "log" ? " (escala logarítmica)" : ""}
          </h3>
          <HistogramChart
            histogram={v.histogram}
            label={v.label}
            unit={v.unit === "bytes" ? "bytes" : ""}
            discrete={v.kind === "discrete"}
          />
        </div>
      </div>
      <div className="mt-4">
        <Insight>{describe(v)}</Insight>
      </div>
    </Panel>
  );
}

function Position({ p, i }: { p: PositionVar; i: number }) {
  const f = fmtFor(p.unit);
  const log = p.unit === "bytes";
  const q = p.quartiles;
  const dec = Object.entries(p.deciles) as [string, number][];
  return (
    <Panel id={`pos-${p.key}`} index={i} title={p.label}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Boxplot box={p.boxplot} label={p.label} unit={p.unit} log={log} />
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Q1 (P25)" value={f(q.q1)} />
            <Stat label="Q2 mediana" value={f(q.q2)} />
            <Stat label="Q3 (P75)" value={f(q.q3)} />
            <Stat label="IQR = Q3 − Q1" value={f(q.iqr)} />
          </dl>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Deciles y percentiles destacados de {p.label}</caption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  {dec.map(([k]) => (
                    <TableHead key={k} scope="col" className="text-right">
                      {k.toUpperCase()}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  {dec.map(([k, v]) => (
                    <TableCell key={k} className="text-right tabular-nums">
                      {f(v)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            <Stat label="P90" value={f(p.highlights.p90)} />
            <Stat label="P95" value={f(p.highlights.p95)} />
            <Stat label="P99" value={f(p.highlights.p99)} />
          </dl>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="mb-1 font-heading text-lg font-semibold">Curva de percentiles</h3>
            <PercentileChart
              data={p.percentiles}
              label={p.label}
              log={log}
              unit={p.unit}
              marks={[
                { p: 50, label: "P50" },
                { p: 90, label: "P90" },
              ]}
            />
          </div>
          {p.rank_examples.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <caption className="sr-only">Percentil de valores concretos de {p.label}</caption>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col">Valor de referencia</TableHead>
                    <TableHead scope="col" className="text-right">Valor</TableHead>
                    <TableHead scope="col" className="text-right">Percentil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.rank_examples.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{f(r.value)}</TableCell>
                      <TableCell className="text-right tabular-nums">P{num(r.percentile_rank, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <Insight>
          El 50 % central de {WHAT[p.key] ?? p.label} está entre {f(q.q1)} y {f(q.q3)} (rango
          intercuartílico {f(q.iqr)}). El P90 es {f(p.highlights.p90)}: solo 1 de cada 10 valores lo
          supera, y el P99 ({f(p.highlights.p99)}) marca los casos verdaderamente extremos
          {p.boxplot.max > p.boxplot.whisker_high
            ? `; el máximo (${f(p.boxplot.max)}) queda fuera del bigote (${f(p.boxplot.whisker_high)}), es decir, es atípico.`
            : "."}
        </Insight>
      </div>
    </Panel>
  );
}

export default async function Estadistica({ searchParams }: { searchParams: Promise<SP> }) {
  const hours = parseHours(await searchParams);
  const [d, p] = await Promise.all([getDescriptive(hours), getPositions(hours)]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        title="Estadística descriptiva y posición"
        lead="Resumen numérico y gráfico de las variables observadas: tamaño de archivo, llegadas por hora, muestras por familia y tags por muestra."
        path="/estadistica"
        hours={hours}
      />

      <nav aria-label="Secciones" className="mt-6 flex flex-wrap gap-2 text-sm">
        <a href="#descriptiva" className="rounded-full border border-border px-3.5 py-1.5 hover:border-primary hover:text-primary">
          Tema 6 · Descriptiva
        </a>
        <a href="#posicion" className="rounded-full border border-border px-3.5 py-1.5 hover:border-primary hover:text-primary">
          Tema 7 · Medidas de posición
        </a>
      </nav>

      <div className="mt-8 space-y-6">
        <section id="descriptiva" className="scroll-mt-20 space-y-6" aria-label="Estadística descriptiva">
          <div>
            <p className="font-heading text-sm font-semibold uppercase tracking-widest text-primary">Tema 6</p>
            <h2 className="text-3xl font-bold">Estadística descriptiva</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Medidas de tendencia central (media, mediana, moda) y de dispersión (desviación estándar,
              varianza, rango, CV), más la forma de la distribución en el histograma.
            </p>
          </div>
          {!d.ok ? (
            <ApiError error={d.error} />
          ) : (
            d.data.variables.map((v, i) => <Descriptive key={v.key} v={v} i={i} />)
          )}
          <Panel index={5} title="Qué aporta al problema">
            <Relation>
              <p>
                Estas medidas resumen los datos reales antes de proponer un modelo. La <b>diferencia
                entre media y mediana</b> del tamaño de archivo muestra que unos pocos ejecutables enormes
                distorsionan el promedio: por eso conviene describirlo con la mediana y modelarlo con una
                lognormal (tema 12).
              </p>
              <p>
                La <b>dispersión por hora</b> (desviación estándar frente a la media) anticipa el resultado
                de la prueba de Poisson: si la varianza supera con creces a la media, las llegadas son
                ráfagas y no un goteo regular.
              </p>
            </Relation>
          </Panel>
        </section>

        <section id="posicion" className="scroll-mt-20 space-y-6" aria-label="Medidas de posición">
          <div>
            <p className="font-heading text-sm font-semibold uppercase tracking-widest text-primary">Tema 7</p>
            <h2 className="text-3xl font-bold">Medidas de posición</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Cuartiles (Q1–Q3), deciles (D1–D9) y percentiles (P90, P95, P99) dicen en qué lugar de la
              distribución cae un valor. El diagrama de caja los resume: la caja es el 50 % central.
            </p>
          </div>
          {!p.ok ? (
            <ApiError error={p.error} />
          ) : (
            p.data.variables.map((v, i) => <Position key={v.key} p={v} i={i} />)
          )}
          <Panel index={5} title="Qué aporta al problema">
            <Relation>
              <p>
                Los percentiles permiten definir <b>umbrales operativos</b>: por ejemplo, un archivo por
                encima del P90 de tamaño es inusualmente grande dentro del malware observado. En las
                llegadas por hora, el P90 indica el nivel de actividad que solo se supera 1 de cada 10
                horas, útil para alertar picos.
              </p>
              <p>
                El boxplot también marca los <b>atípicos</b> (fuera de Q1 − 1.5·IQR y Q3 + 1.5·IQR), que son
                las muestras que más vale la pena revisar a mano.
              </p>
            </Relation>
          </Panel>
        </section>
      </div>
    </main>
  );
}
