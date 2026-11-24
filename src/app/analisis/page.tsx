import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, Info } from "lucide-react";
import { BazaarError, searchBazaar } from "@/lib/bazaar";
import { analyze, type Analysis } from "@/lib/stats";
import { FlapNumber } from "@/components/flap-number";
import { FamilyBars, HourlyChart } from "@/components/charts";
import { FamilyTable } from "@/components/family-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type SP = { [key: string]: string | string[] | undefined };

const RANGES = [
  { h: 24, label: "24 horas" },
  { h: 72, label: "3 días" },
  { h: 168, label: "7 días" },
];

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)} %`;
const n = (x: number) => x.toLocaleString("es-MX");

/** Titled region of the report: one panel, no nested cards. */
function Panel({
  title,
  hint,
  children,
  className,
  index = 0,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <section
      className={cn(
        "rise rounded-xl border border-border bg-card p-5",
        className,
      )}
      style={{ "--i": index } as React.CSSProperties}
    >
      <h2 className="text-2xl font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Board({ a }: { a: Analysis }) {
  const rows = [
    {
      label: "Muestras descargadas",
      value: n(a.total),
      note: `${n(a.classified)} con familia · ${n(a.unclassified)} sin firma`,
    },
    {
      label: "Familias distintas",
      value: String(a.distinctFamilies),
      note: `El top 5 reúne ${pct(a.top5Share)}`,
    },
    {
      label: "Llegada global λ",
      value: a.lambdaTotal.toFixed(1),
      unit: "/h",
      note: `Ventana observada de ${a.windowHours.toFixed(0)} h`,
    },
    {
      label: "Entropía de Shannon",
      value: a.entropy.toFixed(2),
      unit: "bits",
      note: `Uniformidad ${a.entropyNorm.toFixed(2)} de 1 · Gini-Simpson ${a.giniSimpson.toFixed(2)}`,
    },
  ];
  return (
    <section
      aria-label="Resumen"
      className="rise rounded-xl border border-border bg-card"
    >
      <dl className="flex h-full flex-col divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-1 items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <dt className="text-sm font-medium text-muted-foreground">
                {r.label}
              </dt>
              <dd className="mt-0.5 text-xs text-muted-foreground/80">
                {r.note}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <FlapNumber value={r.value} className="text-4xl" />
              {r.unit && (
                <span className="text-sm text-muted-foreground">{r.unit}</span>
              )}
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Reading({ a }: { a: Analysis }) {
  const top = a.families[0];
  const d = a.dispersion;
  const concentration =
    a.entropyNorm < 0.45 ? "alta" : a.entropyNorm < 0.7 ? "media" : "baja";
  return (
    <div className="space-y-3">
      {top && (
        <Alert>
          <Info />
          <AlertTitle className="text-base">
            {top.family} domina la muestra
          </AlertTitle>
          <AlertDescription>
            Representa {pct(top.p)} de las muestras clasificadas (IC 95 %{" "}
            {pct(top.ciLow)}–{pct(top.ciHigh)}). Si llega una muestra nueva,
            hay {pct(top.p)} de probabilidad de que sea {top.family}. La
            concentración es {concentration}: el top 5 suma {pct(a.top5Share)}.
          </AlertDescription>
        </Alert>
      )}
      {d &&
        (d.pValue > 0.05 ? (
          <Alert>
            <CheckCircle2 />
            <AlertTitle className="text-base">
              Las llegadas se ajustan a Poisson
            </AlertTitle>
            <AlertDescription>
              Índice de dispersión {d.index.toFixed(2)} (p ≈{" "}
              {d.pValue.toFixed(3)}): no hay evidencia contra el modelo.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-primary/40 bg-primary/5">
            <AlertTriangle className="text-primary" />
            <AlertTitle className="text-base text-primary">
              Poisson simple no alcanza: llegan en ráfagas
            </AlertTitle>
            <AlertDescription>
              Índice de dispersión {d.index.toFixed(1)} (χ² = {d.chi2.toFixed(0)},
              gl = {d.df}, p ≈ {d.pValue.toFixed(3)}).{" "}
              {d.index > 1
                ? "Hay sobredispersión, así que las probabilidades de “al menos una aparición” son una cota inferior."
                : "Hay subdispersión: las llegadas son más regulares que Poisson."}
            </AlertDescription>
          </Alert>
        ))}
    </div>
  );
}

function Report({ a, hours }: { a: Analysis; hours: number }) {
  const top = a.families.slice(0, 10);
  const rest = a.families.slice(10);
  const restCount = rest.reduce((s, f) => s + f.count, 0);
  const bars = [
    ...top.map((f) => ({ family: f.family, count: f.count, p: f.p })),
    ...(rest.length
      ? [
          {
            family: `Otras (${rest.length})`,
            count: restCount,
            p: restCount / a.classified,
          },
        ]
      : []),
  ];

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Board a={a} />
        <Panel
          index={1}
          title="Distribución por familia"
          hint={`P(familia) = muestras de la familia ÷ ${n(a.classified)} clasificadas. Datos del ${a.windowStart} al ${a.windowEnd} UTC.`}
        >
          <FamilyBars data={bars} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Panel
          index={2}
          title="Lectura del modelo"
          hint="Qué dicen los números, sin jerga."
        >
          <Reading a={a} />
        </Panel>
        <Panel
          index={3}
          title="Patrón temporal"
          hint="Muestras nuevas por hora (UTC). Los picos explican la sobredispersión."
        >
          <HourlyChart data={a.hourly} />
        </Panel>
      </div>

      <Panel
        index={4}
        title="Modelo de aparición por familia"
        hint="Multinomial para “¿de qué familia será la próxima muestra?” y Poisson para “¿aparecerá al menos una en t horas?”. Ordena o filtra con la tabla."
      >
        <FamilyTable
          rows={a.families.map((f) => ({
            family: f.family,
            count: f.count,
            p: f.p,
            ciLow: f.ciLow,
            ciHigh: f.ciHigh,
            ratePerHour: f.ratePerHour,
            pNextHour: f.pNextHour,
            pNext24h: f.pNext24h,
          }))}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel index={5} title="Cómo se calcula">
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <b className="text-foreground">Multinomial:</b> pᵢ = nᵢ / N, con
              intervalo de Wilson al 95 %.
            </li>
            <li>
              <b className="text-foreground">Poisson:</b> λᵢ = nᵢ / T muestras
              por hora; P(≥1 en t h) = 1 − e<sup>−λᵢ·t</sup>.
            </li>
            <li>
              <b className="text-foreground">Prueba de dispersión:</b> χ² =
              Σ(xₕ − x̄)² / x̄ sobre los conteos por hora; si p &lt; 0.05 se
              rechaza Poisson simple.
            </li>
            <li>
              <b className="text-foreground">Diversidad:</b> entropía de
              Shannon H = −Σ pᵢ log₂ pᵢ e índice de Gini-Simpson.
            </li>
          </ul>
        </Panel>
        <Panel index={6} title="Tipos de archivo">
          <div className="flex flex-wrap gap-2">
            {a.fileTypes.slice(0, 12).map((t) => (
              <Badge key={t.type} variant="secondary" className="h-7 px-2.5 text-sm">
                {t.type}
                <span className="ml-1.5 text-muted-foreground">
                  {pct(t.p)}
                </span>
              </Badge>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            Ventana pedida: {hours} h. La API puede acotar los registros, por
            eso las tasas usan la ventana realmente observada.
          </p>
        </Panel>
      </div>
    </div>
  );
}

export default async function Analisis({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.hours) ? sp.hours[0] : sp.hours;
  const hours = Math.min(Math.max(Number(raw) || 168, 1), 168);

  let analysis: Analysis | null = null;
  let error: string | null = null;
  try {
    const res = await searchBazaar("recent", String(hours));
    if (res.query_status !== "ok") error = `La API respondió: ${res.query_status}`;
    else analysis = analyze(res.data ?? []);
  } catch (e) {
    error =
      e instanceof BazaarError
        ? e.message
        : "No se pudo conectar con la API de MalwareBazaar.";
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold sm:text-5xl">
            Análisis probabilístico de malware
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Registros reales de MalwareBazaar, clasificados por familia, con su
            distribución estadística y un modelo de probabilidad de aparición.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Rango de tiempo"
            className="inline-flex rounded-lg border border-border bg-card p-0.5"
          >
            {RANGES.map((r) => (
              <Link
                key={r.h}
                href={`/analisis?hours=${r.h}`}
                aria-current={r.h === hours ? "true" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  r.h === hours
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
          {analysis && (
            <a
              href={`/analisis/csv?hours=${hours}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Download className="size-4" aria-hidden />
              Descargar CSV
            </a>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertTriangle />
          <AlertTitle>No se pudieron cargar los datos</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {analysis && analysis.total === 0 && (
        <p className="mt-8 text-muted-foreground">
          No hay muestras en este rango. Prueba con una ventana mayor.
        </p>
      )}
      {analysis && analysis.total > 0 && <Report a={analysis} hours={hours} />}
    </main>
  );
}
