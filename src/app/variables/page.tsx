import { getRandomVariables } from "@/lib/api";
import type { RandomVariables, RvBase } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { bytes, num, pct, prob } from "@/lib/format";
import { PageHeader } from "@/components/window-controls";
import { ApiError, Insight, Panel, Relation, Stat } from "@/components/section";
import { CdfChart, LognormalPdfChart, PmfChart } from "@/components/stat-charts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Variables aleatorias · Bazaar Board" };

const KIND = { discrete: "Discreta", continuous: "Continua" } as const;

function Head({ v }: { v: RvBase }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Badge>{v.id}</Badge>
      <Badge variant="secondary">{KIND[v.kind]}</Badge>
      <span className="text-sm text-muted-foreground">Soporte: {v.support}</span>
    </div>
  );
}

function Summary({ rv }: { rv: RandomVariables }) {
  const rows = [rv.X, rv.Y, rv.Z];
  return (
    <Panel index={0} topic="Tema 12" title="Tres variables aleatorias del problema">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <caption className="sr-only">Resumen de las variables aleatorias X, Y y Z</caption>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Variable</TableHead>
              <TableHead scope="col">Tipo</TableHead>
              <TableHead scope="col">Soporte</TableHead>
              <TableHead scope="col" className="text-right">E[·]</TableHead>
              <TableHead scope="col" className="text-right">Var[·]</TableHead>
              <TableHead scope="col">Modelo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="whitespace-normal">
                  <b>{v.id}</b> · {v.name}
                  <span className="block text-xs text-muted-foreground">{v.description}</span>
                </TableCell>
                <TableCell>{KIND[v.kind]}</TableCell>
                <TableCell className="whitespace-normal">{v.support}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {v.id === "Y" ? bytes(v.mean) : num(v.mean, 3)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {v.id === "Y" ? v.variance.toExponential(2) : num(v.variance, 3)}
                </TableCell>
                <TableCell>
                  {v.id === "X" ? "Poisson / Bin. Negativa" : v.id === "Y" ? "Lognormal" : "pmf empírica"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4">
        <Relation>
          <p>
            Una <b>variable aleatoria</b> asigna un número a cada muestra o intervalo. <b>X</b> cuenta
            cuántas muestras llegan por hora (discreta), <b>Y</b> mide el tamaño del archivo en bytes
            (continua) y <b>Z</b> cuenta cuántas etiquetas lleva una muestra (discreta). Son los tres
            modelos de “cuánto” y “cuántas” que completan el análisis de familias.
          </p>
          <p>
            Discreta: se describe con una pmf P(X = k) y E[X] = Σ k·P(X = k). Continua: con una densidad
            f(y) y E[Y] = ∫ y·f(y) dy; las probabilidades son áreas bajo la curva.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

function VarX({ x }: { x: RandomVariables["X"] }) {
  const hasNb = x.pmf.some((d) => d.neg_binomial != null);
  const over = x.dispersion_index > 1.2;
  return (
    <Panel
      id="x"
      index={1}
      title="X: muestras por hora"
      hint="Modelo de conteo: ¿cuántas muestras nuevas llegan en una hora cualquiera?"
    >
      <Head v={x} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PmfChart
          label="Distribución del número de muestras por hora: observada frente a Poisson"
          data={x.pmf.map((d) => ({
            k: d.k,
            empirical: d.empirical,
            poisson: d.poisson,
            ...(hasNb ? { neg_binomial: d.neg_binomial ?? 0 } : {}),
          }))}
          series={[
            { key: "empirical", label: "Observada", kind: "bar" },
            { key: "poisson", label: `Poisson(λ = ${x.lambda.toFixed(1)})`, kind: "line" },
            ...(hasNb ? [{ key: "neg_binomial", label: "Binomial negativa", kind: "line" as const }] : []),
          ]}
          xLabel="k = muestras en una hora"
          height={300}
        />
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Stat label="E[X] = λ" value={x.mean.toFixed(2)} note="muestras por hora en promedio" />
          <Stat label="Var[X]" value={x.variance.toFixed(2)} note="Poisson exige Var = E" />
          <Stat label="Índice de dispersión" value={x.dispersion_index.toFixed(2)} note="Var / E; 1 = Poisson" />
          {x.gof && (
            <Stat
              label={`χ² de ajuste (${x.gof.model})`}
              value={x.gof.chi2.toFixed(1)}
              note={`gl = ${x.gof.df} · p ${x.gof.p_value < 0.001 ? "< 0.001" : "= " + x.gof.p_value.toFixed(3)}`}
            />
          )}
        </dl>
      </div>
      <div className="mt-4 space-y-3">
        <Insight>
          {over
            ? `La varianza (${x.variance.toFixed(1)}) es ${x.dispersion_index.toFixed(1)} veces la media (${x.mean.toFixed(1)}): hay sobredispersión. Las llegadas son más irregulares que un Poisson puro (horas muy tranquilas y horas con ráfagas)${hasNb ? ", y la binomial negativa, que admite Var > E, se ajusta mejor" : ""}.`
            : "La varianza es cercana a la media, como en un Poisson: las llegadas se comportan como eventos independientes a ritmo constante."}
          {x.gof && ` El contraste χ² ${x.gof.p_value < 0.05 ? "rechaza" : "no rechaza"} el modelo ${x.gof.model} (p ${x.gof.p_value < 0.001 ? "< 0.001" : "≈ " + x.gof.p_value.toFixed(3)}).`}
        </Insight>
        {x.tail.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Probabilidades puntuales y de cola de X</caption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">k</TableHead>
                  <TableHead scope="col" className="text-right">P(X = k)</TableHead>
                  <TableHead scope="col" className="text-right">P(X ≥ k)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {x.tail.map((t) => (
                  <TableRow key={t.k}>
                    <TableCell className="font-medium">{t.k}</TableCell>
                    <TableCell className="text-right tabular-nums">{prob(t.p_equal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(t.p_at_least, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Relation>
          <p>
            P(X ≥ k) responde preguntas operativas: “¿qué tan probable es que en una hora lleguen al
            menos k muestras?”. Es la base de las alertas por pico y de la tasa λ que alimenta las
            probabilidades de aparición por familia.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

function VarY({ y }: { y: RandomVariables["Y"] }) {
  const { mu, sigma } = y.lognormal;
  return (
    <Panel
      id="y"
      index={2}
      title="Y: tamaño del archivo"
      hint="Variable continua y muy asimétrica: se modela con una lognormal, es decir, ln Y ~ Normal(μ, σ²)."
    >
      <Head v={y} />
      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="μ (de ln Y)" value={mu.toFixed(3)} />
        <Stat label="σ (de ln Y)" value={sigma.toFixed(3)} />
        <Stat label="Mediana del modelo e^μ" value={bytes(Math.exp(mu))} />
        <Stat label="E[Y] = e^(μ+σ²/2)" value={bytes(Math.exp(mu + (sigma * sigma) / 2))} note={`observada: ${bytes(y.mean)}`} />
        <Stat label="Var[Y]" value={y.variance.toExponential(2)} />
        <Stat
          label="Kolmogorov–Smirnov"
          value={`D = ${y.ks.statistic.toFixed(3)}`}
          note={`p ${y.ks.p_value < 0.001 ? "< 0.001" : "= " + y.ks.p_value.toFixed(3)}`}
        />
      </dl>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 font-heading text-lg font-semibold">Densidad: datos frente a modelo</h3>
          <LognormalPdfChart curve={y.curve} histogram={y.histogram} />
        </div>
        <div>
          <h3 className="mb-1 font-heading text-lg font-semibold">Función de distribución acumulada</h3>
          <CdfChart curve={y.curve} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <Insight>
          Si las dos curvas se pegan, el modelo describe bien los datos. D = {y.ks.statistic.toFixed(3)} es
          la mayor distancia vertical entre ambas acumuladas
          {y.ks.p_value < 0.05
            ? "; con tantas muestras la prueba detecta diferencias pequeñas (p < 0.05), pero revisa la gráfica: la forma general (cola larga a la derecha) sí es lognormal."
            : "; la prueba no rechaza la lognormal (p ≥ 0.05)."}{" "}
          La media ({bytes(y.mean)}) queda muy por encima de la mediana ({bytes(Math.exp(mu))}) porque la
          cola derecha es larga.
        </Insight>
        {y.probabilities.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Probabilidades del tamaño de archivo: modelo frente a datos</caption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Evento</TableHead>
                  <TableHead scope="col" className="text-right">Modelo lognormal</TableHead>
                  <TableHead scope="col" className="text-right">Datos reales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {y.probabilities.map((p) => (
                  <TableRow key={p.label}>
                    <TableCell>{p.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(p.p_model, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(p.p_empirical, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Relation>
          <p>
            Los tamaños de malware van de unos cientos de bytes a decenas de megabytes: el logaritmo
            “comprime” esa cola y la hace casi simétrica. Un buen ajuste lognormal permite estimar, por
            ejemplo, la probabilidad de que una muestra pese más de 1 MiB sin revisar cada archivo.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

function VarZ({ z }: { z: RandomVariables["Z"] }) {
  return (
    <Panel id="z" index={3} title="Z: etiquetas por muestra" hint="Conteo discreto: cuántos tags describen una muestra.">
      <Head v={z} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PmfChart
          label="Distribución del número de tags por muestra"
          data={z.pmf.map((d) => ({ k: d.k, empirical: d.empirical }))}
          series={[{ key: "empirical", label: "P(Z = k)", kind: "bar" }]}
          xLabel="k = número de tags"
          height={240}
        />
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Stat label="E[Z]" value={z.mean.toFixed(3)} note="tags por muestra, en promedio" />
          <Stat label="Var[Z]" value={z.variance.toFixed(3)} />
          <Stat label="σ" value={Math.sqrt(z.variance).toFixed(3)} note="desviación estándar" />
        </dl>
      </div>
      <div className="mt-4 space-y-3">
        <Insight>
          En promedio una muestra lleva {z.mean.toFixed(2)} tags, con desviación de{" "}
          {Math.sqrt(z.variance).toFixed(2)}. La pmf muestra qué fracción de muestras tiene 0, 1, 2… tags:
          {" "}
          {(() => {
            const p0 = z.pmf.find((d) => d.k === 0)?.empirical;
            return p0 != null ? `${pct(p0, 1)} no trae ninguna etiqueta, así que el evento “con tags” (D) deja fuera a una parte relevante de las muestras.` : "";
          })()}
        </Insight>
        <Relation>
          <p>
            Los tags alimentan los pares de combinatoria (tema 5) y la evidencia del laboratorio de Bayes.
            Z indica cuánta información descriptiva suele acompañar a una muestra.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

export default async function Variables({ searchParams }: { searchParams: Promise<SP> }) {
  const hours = parseHours(await searchParams);
  const res = await getRandomVariables(hours);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        title="Variables aleatorias"
        lead="X (muestras por hora), Y (tamaño de archivo) y Z (tags por muestra): su tipo, su distribución observada frente al modelo teórico, esperanza y varianza."
        path="/variables"
        hours={hours}
      />
      {!res.ok ? (
        <ApiError error={res.error} />
      ) : (
        <div className="mt-8 space-y-6">
          <Summary rv={res.data} />
          <VarX x={res.data.X} />
          <VarY y={res.data.Y} />
          <VarZ z={res.data.Z} />
        </div>
      )}
    </main>
  );
}
