import { Check, X } from "lucide-react";
import { getProbability } from "@/lib/api";
import type { EventInfo, Probability } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { num, pct, prob } from "@/lib/format";
import { PageHeader } from "@/components/window-controls";
import { ApiError, Expose, Insight, Panel, Relation, Stat } from "@/components/section";
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
  const top = [...p.events].sort((a, b) => b.p - a.p)[0];
  return (
    <Panel
      id="eventos"
      index={0}
      topic="Tema 8 · Espacio muestral"
      title="Eventos sobre las muestras"
      hint={`Ω = las ${num(p.n)} muestras con datos completos. P(evento) = muestras del evento ÷ ${num(p.n)}.`}
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
          Un evento con 0 muestras ({p.events.filter((e) => e.count === 0).map((e) => e.id).join(", ")})
          es imposible en estos datos: su probabilidad es 0. No es un error.
        </p>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Insight>
          {top
            ? `De cada 100 muestras, ${Math.round(top.p * 100)} cumplen el evento ${top.id} (${top.name}).`
            : "Sin eventos."}{" "}
          P(evento) es la frecuencia relativa: favorables entre totales.
        </Insight>
        <Relation>
          <p>
            Cada muestra es un resultado posible. Un evento es un grupo de muestras, por ejemplo
            “es un ejecutable”.
          </p>
        </Relation>
      </div>
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
      title="Axiomas de probabilidad con los datos"
      hint="(1) P(A) ≥ 0 · (2) P(Ω) = 1 · (3) si A y B no se cruzan, P(A ∪ B) = P(A) + P(B)."
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
            ? "Se cumplen los tres axiomas. Las probabilidades de todas las familias suman 1, porque cada muestra es de una sola familia."
            : "Algún axioma falla; mira el detalle en rojo. Con frecuencias relativas no debería pasar: habría un error en la clasificación."}
        </Insight>
        <Relation>
          <p>
            Las familias reparten todas las muestras sin cruzarse. Por eso sus probabilidades suman 1.
          </p>
        </Relation>
      </div>
    </Panel>
  );
}

function Independence({ p }: { p: Probability }) {
  const pairs = p.independence;
  const dep = pairs.filter((x) => !x.independent);
  const name = (id: EventInfo["id"]) => p.events.find((e) => e.id === id)?.name ?? id;
  const ex = [...pairs].sort((a, b) => b.abs_diff - a.abs_diff)[0];
  return (
    <Panel
      id="independencia"
      index={2}
      topic="Tema 9 · Independencia"
      title="¿A y B son independientes?"
      hint="Son independientes si P(A ∩ B) = P(A) · P(B). Aquí decimos “independientes (aprox.)” si la diferencia es de 0.01 o menos."
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <caption className="sr-only">Independencia para cada par de eventos</caption>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col">Par</TableHead>
              <TableHead scope="col" className="text-right">P(A)</TableHead>
              <TableHead scope="col" className="text-right">P(B)</TableHead>
              <TableHead scope="col" className="text-right">P(A∩B)</TableHead>
              <TableHead scope="col" className="text-right">P(A)·P(B)</TableHead>
              <TableHead scope="col" className="text-right">Diferencia</TableHead>
              <TableHead scope="col">Veredicto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pairs.map((x) => (
              <TableRow key={`${x.a}${x.b}`}>
                <TableCell className="font-medium">
                  {x.a}, {x.b}
                </TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_a)}</TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_b)}</TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_ab)}</TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.p_a_times_p_b)}</TableCell>
                <TableCell className="text-right tabular-nums">{prob(x.abs_diff)}</TableCell>
                <TableCell>
                  <Verdict ok={x.independent} yes="Independientes (aprox.)" no="Dependientes" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 space-y-3">
        <Insight title="Ejemplo">
          {ex
            ? `Tomemos ${ex.a} (${name(ex.a)}) y ${ex.b} (${name(ex.b)}). Si fueran independientes, P(A∩B) sería P(A)·P(B) = ${prob(ex.p_a)} × ${prob(ex.p_b)} = ${prob(ex.p_a_times_p_b)}. En los datos es ${prob(ex.p_ab)}. La diferencia es ${prob(ex.abs_diff)}, así que ${ex.independent ? "se parecen: son independientes (aprox.)" : "no se parecen: son dependientes"}.`
            : "No hay pares para comparar."}{" "}
          {pairs.length > 0 &&
            (dep.length === 0
              ? "Todos los pares son independientes (aprox.)."
              : `${dep.length} de ${pairs.length} pares son dependientes.`)}
        </Insight>
        <Relation>
          <p>
            Si dos rasgos fueran independientes, saber uno no ayudaría a adivinar el otro. Cuando hay
            pares dependientes, conocer un rasgo sí ayuda. Eso lleva a Bayes.
          </p>
        </Relation>
        <Expose
          items={[
            "Independientes: P(A∩B) = P(A)·P(B).",
            dep.length === 0
              ? "En estos datos todos los pares cumplen la igualdad (aprox.)."
              : `En estos datos, ${dep.length} de ${pairs.length} pares no la cumplen.`,
            "Dependientes significa que saber A cambia la probabilidad de B.",
          ]}
        />
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
      title="P(A | B): probabilidad de A sabiendo que pasó B"
      hint="P(A | B) = P(A ∩ B) / P(B). Cada columna es “ya pasó B”; la fila es el evento A."
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
            ? `Por ejemplo, si una muestra cumple “${label(c.events[b.j])}” (${c.events[b.j]}), la probabilidad de que además cumpla “${label(c.events[b.i])}” (${c.events[b.i]}) es ${pct(b.v)}; sin saberlo era ${pct(p.events.find((e) => e.id === c.events[b.i])?.p ?? 0)}.`
            : "Sin ejemplos que destacar."}
        </Insight>
      </div>

      <h3 className="mb-1 mt-8 font-heading text-xl font-semibold">
        P(familia | tipo de archivo)
      </h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Dentro de cada tipo de archivo, qué parte es de cada familia. Solo se muestran las{" "}
        {g.families.length} familias principales, por eso cada columna suma menos de 100 %.
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
              ? `De cada 100 archivos “${top.t}”, ${Math.round(top.v * 100)} son ${top.f}. Saber el tipo de archivo ayuda a adivinar la familia.`
              : "Sin asociaciones que destacar.";
          })()}
        </Insight>
        <Relation>
          <p>
            Responde “si me llega un .exe, ¿de qué familia es más probable?”. Es el paso previo a
            Bayes.
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
        lead="Eventos A–F sobre las muestras reales: axiomas, independencia y probabilidad condicional."
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
