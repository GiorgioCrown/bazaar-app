import { getRandomVariables } from "@/lib/api";
import type { RandomVariables, RvBase, RvDiscrete } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { bytes, num, pct, prob } from "@/lib/format";
import { PageHeader } from "@/components/window-controls";
import { ApiError, Expose, Insight, Panel, Relation, Stat } from "@/components/section";
import { CdfChart, DensityChart, PmfChart } from "@/components/stat-charts";
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
      <span className="text-sm text-muted-foreground">Valores posibles: {v.support}</span>
    </div>
  );
}

function Summary({ rv }: { rv: RandomVariables }) {
  const rows = [rv.X, rv.Y, rv.Z];
  const isY = (v: RvBase) => v.id === "Y";
  return (
    <Panel index={0} topic="Tema 12" title="Discreta o continua">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <caption className="sr-only">Resumen de las variables aleatorias X, Y y Z</caption>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Variable</TableHead>
              <TableHead scope="col">Tipo</TableHead>
              <TableHead scope="col" className="text-right">E[·]</TableHead>
              <TableHead scope="col" className="text-right">Var[·]</TableHead>
              <TableHead scope="col" className="text-right">Desv. estándar</TableHead>
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
                <TableCell className="text-right tabular-nums">
                  {isY(v) ? bytes(v.mean) : num(v.mean, 3)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isY(v) ? v.variance.toExponential(2) : num(v.variance, 3)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isY(v) ? bytes(v.std) : num(v.std, 3)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 space-y-3">
        <Insight>
          Una variable aleatoria es un número que sale de cada muestra o de cada hora.{" "}
          <b className="text-foreground">Discreta</b>: se cuenta y solo toma valores sueltos (0, 1,
          2…). Es el caso de X (muestras por hora) y Z (tags por muestra).{" "}
          <b className="text-foreground">Continua</b>: se mide y puede tomar cualquier valor en un
          intervalo. Es el caso de Y (tamaño del archivo en bytes).
        </Insight>
        <Relation>
          <p>
            Discreta: E[X] = Σ k · P(X = k). Continua: las probabilidades son áreas bajo el
            histograma de densidad. En las dos, la varianza dice qué tanto se alejan los valores de E.
          </p>
        </Relation>
        <Expose
          items={[
            `En promedio llegan ${num(rv.X.mean, 1)} muestras por hora, con desviación ${num(rv.X.std, 1)}.`,
            `Una muestra pesa en promedio ${bytes(rv.Y.mean)}.`,
            `Una muestra trae en promedio ${num(rv.Z.mean, 2)} tags.`,
          ]}
        />
      </div>
    </Panel>
  );
}

function Discrete({
  v,
  index,
  id,
  title,
  hint,
  unitLabel,
  xLabel,
  relation,
}: {
  v: RvDiscrete;
  index: number;
  id: string;
  title: string;
  hint: string;
  unitLabel: string;
  xLabel: string;
  relation: string;
}) {
  const top = v.pmf.reduce((m, d) => (d.empirical > m.empirical ? d : m), v.pmf[0]);
  return (
    <Panel id={id} index={index} title={title} hint={hint}>
      <Head v={v} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PmfChart
          label={`Distribución de ${title.toLowerCase()}`}
          data={v.pmf.map((d) => ({ k: d.k, empirical: d.empirical }))}
          series={[{ key: "empirical", label: `P(${v.id} = k)`, kind: "bar" }]}
          xLabel={xLabel}
          height={280}
        />
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Stat label={`E[${v.id}]`} value={v.mean.toFixed(2)} note={`${unitLabel}, en promedio`} />
          <Stat label={`Var[${v.id}]`} value={v.variance.toFixed(2)} />
          <Stat label="Desviación estándar" value={v.std.toFixed(2)} note="raíz de la varianza" />
        </dl>
      </div>
      <div className="mt-4 space-y-3">
        <Insight>
          {top
            ? `El valor más probable es ${v.id} = ${top.k}: de cada 100, ${Math.round(top.empirical * 100)} lo tienen. `
            : ""}
          El promedio E[{v.id}] es {v.mean.toFixed(2)} y la desviación es {v.std.toFixed(2)}.
        </Insight>
        {v.tail.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Probabilidades de {v.id}: igual a k y de k en adelante</caption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">k</TableHead>
                  <TableHead scope="col" className="text-right">P({v.id} = k)</TableHead>
                  <TableHead scope="col" className="text-right">P({v.id} ≥ k)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.tail.map((t) => (
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
          <p>{relation}</p>
        </Relation>
        <Expose
          items={[
            `${v.id} es discreta: solo toma valores enteros (${v.support}).`,
            `E[${v.id}] = Σ k·P(${v.id} = k) = ${v.mean.toFixed(2)}.`,
            `Var[${v.id}] = ${v.variance.toFixed(2)}, desviación = ${v.std.toFixed(2)}.`,
          ]}
        />
      </div>
    </Panel>
  );
}

function VarY({ y }: { y: RandomVariables["Y"] }) {
  const first = y.probabilities[0];
  return (
    <Panel
      id="y"
      index={2}
      title="Y: tamaño del archivo"
      hint="Variable continua: puede ser cualquier número de bytes. Las probabilidades salen de áreas, no de valores sueltos."
    >
      <Head v={y} />
      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="E[Y]" value={bytes(y.mean)} note="tamaño promedio" />
        <Stat label="Var[Y]" value={y.variance.toExponential(2)} note="bytes al cuadrado" />
        <Stat label="Desviación estándar" value={bytes(y.std)} />
      </dl>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 font-heading text-lg font-semibold">Histograma de densidad</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            El área de cada barra es la probabilidad de caer en ese intervalo de tamaño.
          </p>
          <DensityChart histogram={y.histogram} />
        </div>
        <div>
          <h3 className="mb-1 font-heading text-lg font-semibold">Función acumulada F(y)</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            F(y) = P(Y ≤ y): la parte de las muestras que pesa y o menos.
          </p>
          <CdfChart curve={y.cdf} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {y.probabilities.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <caption className="sr-only">Probabilidades del tamaño de archivo por intervalo</caption>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Intervalo</TableHead>
                  <TableHead scope="col" className="text-right">Probabilidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {y.probabilities.map((p) => (
                  <TableRow key={p.label}>
                    <TableCell>{p.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(p.p_empirical, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Insight>
          {first
            ? `De cada 100 muestras, ${Math.round(first.p_empirical * 100)} caen en “${first.label}”. `
            : ""}
          El tamaño promedio es {bytes(y.mean)}, pero hay pocos archivos muy grandes que suben el
          promedio.
        </Insight>
        <Relation>
          <p>
            Como Y es continua, no tiene sentido P(Y = 5000 bytes exactos). Se pregunta por
            intervalos, por ejemplo “¿qué tan probable es que pese más de 1 MiB?”.
          </p>
        </Relation>
        <Expose
          items={[
            "Y es continua: se mide en bytes y puede ser cualquier valor.",
            `E[Y] = ${bytes(y.mean)}, desviación = ${bytes(y.std)}.`,
            first
              ? `P(${first.label}) = ${pct(first.p_empirical, 1)}.`
              : "Las probabilidades se calculan por intervalos.",
          ]}
        />
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
        lead="X (muestras por hora), Y (tamaño de archivo) y Z (tags por muestra): su distribución, su esperanza y su varianza."
        path="/variables"
        hours={hours}
      />
      {!res.ok ? (
        <ApiError error={res.error} />
      ) : (
        <div className="mt-8 space-y-6">
          <Summary rv={res.data} />
          <Discrete
            v={res.data.X}
            index={1}
            id="x"
            title="X: muestras por hora"
            hint="Variable discreta: cuenta cuántas muestras nuevas llegan en una hora."
            unitLabel="muestras por hora"
            xLabel="k = muestras en una hora"
            relation="Dice cuántas muestras esperamos cada hora y qué tan probable es una hora con muchas. P(X ≥ k) responde: ¿cuántas veces llegan k o más?"
          />
          <VarY y={res.data.Y} />
          <Discrete
            v={res.data.Z}
            index={3}
            id="z"
            title="Z: tags por muestra"
            hint="Variable discreta: cuenta cuántas etiquetas (tags) tiene una muestra."
            unitLabel="tags por muestra"
            xLabel="k = número de tags"
            relation="Los tags se usan en los pares de combinatoria y como evidencia en Bayes. Z dice cuánta información trae normalmente una muestra."
          />
        </div>
      )}
    </main>
  );
}
