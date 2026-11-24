import { Check, X } from "lucide-react";
import { getProbability } from "@/lib/api";
import type { EventInfo, Probability } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { num, pct, prob } from "@/lib/format";
import { PageHeader } from "@/components/window-controls";
import { ApiError, Insight, Panel, Relation, Stat } from "@/components/section";
import { HeatTable } from "@/components/heat-table";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Probabilidad, independencia y condicional · Bazaar Board" };

function Verdict({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        ok ? "bg-chart-4/15 text-chart-4" : "bg-destructive/15 text-destructive",
      )}
    >
      {ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
      {ok ? yes : no}
    </span>
  );
}

function Events({ p }: { p: Probability }) {
  return (
    <Panel
      id="eventos"
      index={0}
      topic="Tema 8 · Espacio muestral"
      title="Eventos sobre las muestras"
      hint={`Ω = las ${num(p.n)} muestras de la ventana con metadatos completos (ver nota en Independencia); P(evento) = casos favorables ÷ ${num(p.n)}.`}
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Evento</TableHead>
              <TableHead scope="col">Definición</TableHead>
              <TableHead scope="col" className="text-right">Muestras</TableHead>
              <TableHead scope="col" className="text-right">P(evento)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.events.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Badge className="mr-2">{e.id}</Badge>
                  <span className="font-medium">{e.name}</span>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal text-muted-foreground">
                  {e.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">{num(e.count)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{pct(e.p, 2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {p.events.some((e) => e.count === 0) && (
        <p className="mt-3 text-sm text-muted-foreground">
          Un evento con 0 muestras ({p.events.filter((e) => e.count === 0).map((e) => e.id).join(", ")}) es
          el evento imposible en estos datos: su probabilidad es 0 (cumple el axioma 1), no un error. Por
          ejemplo, la fuente solo lista aquí muestras que ya tienen firma, así que “sin familia” no aparece.
        </p>
      )}
    </Panel>
  );
}

function Axioms({ p }: { p: Probability }) {
  const all = p.axioms.checks.every((c) => c.passed);
  return (
    <Panel
      id="axiomas"
      index={1}
      topic="Tema 8 · Axiomas"
      title="Axiomas de Kolmogorov, verificados con los datos"
      hint="(1) P(A) ≥ 0 · (2) P(Ω) = 1 · (3) si A y B son disjuntos, P(A ∪ B) = P(A) + P(B)."
    >
      <ul className="grid gap-2 md:grid-cols-2">
        {p.axioms.checks.map((c) => (
          <li
            key={c.name}
            className={cn(
              "flex gap-3 rounded-lg border p-3",
              c.passed ? "border-border bg-background/40" : "border-destructive/50 bg-destructive/5",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                c.passed ? "bg-chart-4/20 text-chart-4" : "bg-destructive/20 text-destructive",
              )}
            >
              {c.passed ? <Check className="size-4" aria-label="Cumple" /> : <X className="size-4" aria-label="No cumple" />}
            </span>
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        <Stat
          label="Σ P(familia) en la partición"
          value={p.axioms.partition_sum.toFixed(6)}
          note="familias + “Sin clasificar”"
        />
        <Stat label="Verificaciones superadas" value={`${p.axioms.checks.filter((c) => c.passed).length} / ${p.axioms.checks.length}`} />
      </dl>
      <div className="mt-4 space-y-3">
        <Insight>
          {all
            ? "Todas las verificaciones se cumplen: las frecuencias relativas observadas forman una medida de probabilidad válida. La suma de las probabilidades de todas las familias (incluida la categoría “Sin clasificar”) es exactamente 1, porque cada muestra pertenece a una y solo una."
            : "Alguna verificación falla; revisa el detalle en rojo. Con frecuencias relativas de datos reales esto indicaría un problema en la clasificación de los eventos."}
        </Insight>
        <Relation>
          <p>
            Cada muestra de MalwareBazaar es un resultado de Ω. Los eventos A–F son subconjuntos
            (p. ej. “es un ejecutable PE” o “fue detectada por ClamAV”). Las familias forman una
            partición de Ω: son disjuntas y cubren todo, por eso sus probabilidades suman 1.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

function Independence({ p }: { p: Probability }) {
  const dep = p.independence.filter((x) => !x.independent);
  const byLift = [...dep]
    .filter((x) => x.lift != null)
    .sort((a, b) => Math.abs(Math.log(b.lift ?? 1)) - Math.abs(Math.log(a.lift ?? 1)))[0];
  const name = (id: EventInfo["id"]) => p.events.find((e) => e.id === id)?.name ?? id;
  return (
    <Panel
      id="independencia"
      index={2}
      topic="Tema 9 · Independencia"
      title="¿A y B son independientes?"
      hint="A y B son independientes si P(A ∩ B) = P(A) · P(B). Se contrasta con χ² de Pearson, o con la prueba exacta de Fisher cuando alguna frecuencia esperada es menor que 5 (α = 0.05): p < 0.05 rechaza la independencia."
    >
      <p className="mb-3 text-sm text-muted-foreground">{p.note}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <caption className="sr-only">Prueba de independencia para cada par de eventos</caption>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Par</TableHead>
              <TableHead scope="col" className="text-right">P(A)</TableHead>
              <TableHead scope="col" className="text-right">P(B)</TableHead>
              <TableHead scope="col" className="text-right">P(A∩B)</TableHead>
              <TableHead scope="col" className="text-right">P(A)·P(B)</TableHead>
              <TableHead scope="col" className="text-right">Lift</TableHead>
              <TableHead scope="col" className="text-right">χ²</TableHead>
              <TableHead scope="col">Prueba</TableHead>
              <TableHead scope="col" className="text-right">Esperada mín.</TableHead>
              <TableHead scope="col" className="text-right">p</TableHead>
              <TableHead scope="col">Veredicto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.independence.map((x) => (
              <TableRow key={`${x.a}${x.b}`}>
                <TableCell className="font-medium">
                  {x.a}, {x.b}
                </TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_a)}</TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_b)}</TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_ab)}</TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_a_times_p_b)}</TableCell>
                <TableCell className="text-right tabular-nums">{x.lift == null ? "—" : x.lift.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{x.chi2 == null ? "—" : num(x.chi2, 1)}</TableCell>
                <TableCell>
                  {x.test === "chi2"
                    ? "χ² de Pearson"
                    : x.test === "fisher"
                      ? "Fisher exacto"
                      : "Degenerada"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {x.min_expected == null ? "—" : num(x.min_expected, 1)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {x.p_value == null ? "—" : x.p_value < 0.001 ? "< 0.001" : x.p_value.toFixed(3)}
                </TableCell>
                <TableCell>
                  <Verdict ok={x.independent} yes="Independientes" no="Dependientes" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 space-y-3">
        <Insight title="Veredicto">
          {dep.length === 0
            ? "Ningún par rechaza la independencia al 5 %."
            : `${dep.length} de ${p.independence.length} pares son dependientes (p < 0.05).`}{" "}
          Con test “Fisher exacto” el p-valor es el exacto (la aproximación χ² no es fiable con
          frecuencias esperadas menores que 5); “Degenerada” significa que P(A) o P(B) es 0 o 1, así
          que la independencia se cumple por definición y no hay p-valor. Lift = P(A∩B) / (P(A)·P(B)): 1 significa independencia, más de 1 que A y B ocurren juntos
          más de lo esperado, menos de 1 que se evitan.
          {byLift &&
            ` La dependencia más fuerte es ${byLift.a}–${byLift.b} (lift ${byLift.lift?.toFixed(2)}): “${name(byLift.a)}” y “${name(byLift.b)}” ${(byLift.lift ?? 1) > 1 ? "tienden a coincidir" : "rara vez coinciden"}.`}{" "}
          Con muchas muestras hasta diferencias pequeñas resultan significativas: observa también la
          distancia entre P(A∩B) y P(A)·P(B).
        </Insight>
        <Relation>
          <p>
            Si el tipo de archivo y la familia fueran independientes, conocer uno no ayudaría a
            predecir el otro. Que muchos pares sean dependientes justifica el enfoque de Bayes
            (tema 11): la evidencia observada sí cambia la probabilidad de cada familia.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

function Conditional({ p }: { p: Probability }) {
  const c = p.conditional;
  const g = c.family_given_file_type;
  const label = (id: string) => p.events.find((e) => e.id === id)?.name ?? id;
  // par con mayor aumento: P(A|B) - P(A) más grande fuera de la diagonal
  let best: { i: number; j: number; v: number; gain: number } | null = null;
  c.matrix.forEach((row, i) =>
    row.forEach((v, j) => {
      const base = p.events.find((e) => e.id === c.events[i])?.p ?? 0;
      if (i !== j && v != null && (!best || v - base > best.gain))
        best = { i, j, v, gain: v - base };
    }),
  );
  const b = best as { i: number; j: number; v: number; gain: number } | null;
  return (
    <Panel
      id="condicional"
      index={3}
      topic="Tema 10 · Probabilidad condicional"
      title="P(A | B): probabilidad de A sabiendo B"
      hint="P(A | B) = P(A ∩ B) / P(B). Cada columna es “dado que ocurrió B”; la fila es el evento cuya probabilidad se actualiza."
    >
      <HeatTable
        caption="Matriz de probabilidades condicionales entre eventos: fila A dado columna B"
        corner="P(fila | columna)"
        rows={c.events}
        cols={c.events}
        values={c.matrix}
        rowHeader={(r) => (
          <span title={label(r)}>
            {r} <span className="hidden font-normal text-muted-foreground lg:inline">{label(r)}</span>
          </span>
        )}
        colHeader={(cc) => <span title={label(cc)}>dado {cc}</span>}
        highlightDiagonal
      />
      <div className="mt-3 space-y-3">
        <Insight>
          {b
            ? `Por ejemplo, si una muestra cumple “${label(c.events[b.j])}” (${c.events[b.j]}), la probabilidad de que además cumpla “${label(c.events[b.i])}” (${c.events[b.i]}) es ${pct(b.v)}; sin esa información era ${pct(p.events.find((e) => e.id === c.events[b.i])?.p ?? 0)}. La diagonal vale 100 %: P(A | A) = 1.`
            : "La diagonal vale 100 %: P(A | A) = 1."}
        </Insight>
      </div>

      <h3 className="mb-1 mt-8 font-heading text-xl font-semibold">
        P(familia | tipo de archivo)
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Dentro de cada tipo de archivo, qué fracción pertenece a cada familia (cada columna suma
        menos de 100 % porque solo se muestran las {g.families.length} familias principales).
      </p>
      <HeatTable
        caption="Probabilidad de cada familia dado el tipo de archivo"
        corner="Familia ↓ · tipo →"
        rows={g.families}
        cols={g.file_types}
        values={g.p}
        colHeader={(ft, j) => (
          <span>
            {ft}
            <span className="block text-xs font-normal text-muted-foreground">
              n = {num(g.file_type_counts[j] ?? 0)}
            </span>
          </span>
        )}
      />
      <div className="mt-3 space-y-3">
        <Insight>
          {(() => {
            let top = { f: "", t: "", v: 0 };
            g.p.forEach((row, i) =>
              row.forEach((v, j) => {
                if (v > top.v) top = { f: g.families[i], t: g.file_types[j], v };
              }),
            );
            return top.f
              ? `La asociación más marcada: entre los archivos “${top.t}”, ${pct(top.v)} pertenece a ${top.f}. Saber el tipo de archivo reduce la incertidumbre sobre la familia.`
              : "Sin asociaciones que destacar.";
          })()}
        </Insight>
        <Relation>
          <p>
            La probabilidad condicional es el puente hacia Bayes: P(familia | tipo) responde “si me llega
            un .exe, ¿de qué familia es más probable?”. Es la información que el laboratorio de Bayes
            combina cuando eliges varias evidencias a la vez.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

export default async function Probabilidad({ searchParams }: { searchParams: Promise<SP> }) {
  const hours = parseHours(await searchParams);
  const res = await getProbability(hours);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        title="Probabilidad: axiomas, independencia y condicional"
        lead="Eventos A–F definidos sobre las muestras reales, con sus verificaciones axiomáticas, pruebas de independencia y matrices condicionales."
        path="/probabilidad"
        hours={hours}
      />
      <nav aria-label="Secciones" className="mt-6 flex flex-wrap gap-2 text-sm">
        {[
          ["#axiomas", "Tema 8 · Axiomas"],
          ["#independencia", "Tema 9 · Independencia"],
          ["#condicional", "Tema 10 · Condicional"],
        ].map(([h, l]) => (
          <a key={h} href={h} className="rounded-full border border-border px-3.5 py-1.5 hover:border-primary hover:text-primary">
            {l}
          </a>
        ))}
      </nav>
      {!res.ok ? (
        <ApiError error={res.error} />
      ) : (
        <div className="mt-8 space-y-6">
          <Events p={res.data} />
          <Axioms p={res.data} />
          <Independence p={res.data} />
          <Conditional p={res.data} />
        </div>
      )}
    </main>
  );
}
