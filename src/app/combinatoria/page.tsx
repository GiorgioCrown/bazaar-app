import { getCombinatorics } from "@/lib/api";
import type { CombItem, Combinatorics } from "@/lib/api-types";
import { parseHours, type SP } from "@/lib/params";
import { bigInt, digits, num, pct } from "@/lib/format";
import { PageHeader } from "@/components/window-controls";
import { ApiError, Insight, Panel, Relation, Stat } from "@/components/section";
import { CombCalculator } from "@/components/comb-calculator";
import { PmfChart, RankBars } from "@/components/stat-charts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Análisis combinatorio · Bazaar Board" };

function Items({ items }: { items: CombItem[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((it) => (
        <article key={it.id} className="rounded-lg border border-border bg-background/40 p-4">
          <h3 className="font-heading text-lg font-semibold">{it.title}</h3>
          <p className="mt-1 font-mono text-sm text-primary">{it.formula}</p>
          {Object.keys(it.inputs).length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {Object.entries(it.inputs).map(([k, v]) => (
                <div key={k} className="flex gap-1">
                  <dt>{k} =</dt>
                  <dd className="font-medium text-foreground">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 break-all font-heading text-3xl font-semibold tabular-nums">
            {bigInt(it.result)}
          </p>
          <p className="text-xs text-muted-foreground">
            {digits(it.result)} cifras · log₁₀ ≈ {it.log10.toFixed(2)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.explanation}</p>
        </article>
      ))}
    </div>
  );
}

function Report({ c, hours }: { c: Combinatorics; hours: number }) {
  const { counting, permutations, combinations } = c;
  const hyp = combinations.hypergeometric;
  const profiles = counting.top_profiles.slice(0, 8);
  const pairs = combinations.tag_pairs.slice(0, 10);
  void hours;
  return (
    <div className="mt-8 space-y-6">
      <Panel index={0} title="Tres herramientas de conteo">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Principio de conteo", "Si un proceso tiene m1 · m2 · … pasos independientes, hay m1 × m2 × … resultados. La regla de la suma aplica cuando las opciones son excluyentes (una u otra).", "n₁ · n₂ · … · nᵣ"],
            ["Permutaciones", "Ordenar o elegir k elementos de n cuando el orden importa (un ranking, un podio).", "P(n,k) = n! / (n−k)!"],
            ["Combinaciones", "Elegir k elementos de n cuando el orden no importa (un subconjunto, un par de tags).", "C(n,k) = n! / (k!(n−k)!)"],
          ].map(([t, d, f]) => (
            <div key={t} className="rounded-lg border border-border bg-background/40 p-4">
              <h3 className="font-heading text-lg font-semibold">{t}</h3>
              <p className="mt-1 font-mono text-sm text-primary">{f}</p>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        id="conteo"
        index={1}
        topic="Tema 5 · Principio fundamental"
        title="Perfiles posibles: familia × tipo × entrega"
        hint="Cada muestra tiene un “perfil”: un valor en cada dimensión. El principio multiplicativo cuenta cuántos perfiles distintos podrían existir."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Dimensión</TableHead>
                  <TableHead className="text-right">Valores distintos</TableHead>
                  <TableHead>Ejemplos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counting.dimensions.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(d.cardinality)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {d.values_sample.slice(0, 4).map((v) => (
                          <Badge key={v} variant="outline">{v}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <dl className="grid gap-3">
            <Stat label="Perfiles posibles (producto)" value={bigInt(counting.possible_profiles)} />
            <Stat label="Perfiles realmente observados" value={num(counting.observed_profiles)} />
            <Stat label="Fracción observada" value={pct(counting.observed_fraction, 3)} />
          </dl>
        </div>
        <div className="mt-4 space-y-3">
          <Insight>
            De {bigInt(counting.possible_profiles)} combinaciones teóricas solo aparecen{" "}
            {num(counting.observed_profiles)}: el malware real se concentra en muy pocos perfiles
            (ciertas familias suelen usar un tipo de archivo y un canal de entrega concretos).
          </Insight>
          {profiles.length > 0 && (
            <>
              <h3 className="font-heading text-lg font-semibold">Perfiles más frecuentes</h3>
              <RankBars
                label="Perfiles más frecuentes (familia · tipo · entrega · ClamAV)"
                data={profiles.map((p) => ({ label: p.profile, value: p.count }))}
                labelWidth={260}
              />
            </>
          )}
          <Items items={counting.items} />
        </div>
      </Panel>

      <Panel
        id="permutaciones"
        index={2}
        topic="Tema 5 · Permutaciones"
        title="Rankings: el orden importa"
        hint="Un podio “1.º, 2.º, 3.º” es una permutación: distinto orden, distinto resultado."
      >
        <Items items={permutations.items} />
        {permutations.observed_podium.length > 0 && (
          <div className="mt-4">
            <h3 className="font-heading text-lg font-semibold">Podio observado</h3>
            <ol className="mt-2 grid gap-2 sm:grid-cols-3">
              {permutations.observed_podium.slice(0, 3).map((f, i) => (
                <li key={f.family} className="rounded-lg border border-border bg-background/40 p-3">
                  <span className="font-heading text-2xl font-semibold text-primary">{i + 1}.º</span>{" "}
                  <span className="font-medium">{f.family}</span>
                  <span className="block text-sm text-muted-foreground">{num(f.count)} muestras</span>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <Insight>
                De todos los podios posibles solo uno ocurrió en realidad. Si las familias fueran
                intercambiables, cada orden sería igual de probable; que uno solo ocurra
                sugiere una jerarquía (esta ventana no basta para afirmar que se repita).
              </Insight>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        id="combinaciones"
        index={3}
        topic="Tema 5 · Combinaciones"
        title="Subconjuntos: el orden no importa"
        hint="Elegir muestras, familias o pares de tags sin importar cuál va primero."
      >
        <Items items={combinations.items} />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-heading text-lg font-semibold">Pares de tags más frecuentes</h3>
            <p className="mb-2 text-sm text-muted-foreground">
              Cada par {"{a, b}"} es una combinación C(t, 2); los de arriba aparecen juntos en más muestras.
            </p>
            {pairs.length > 0 ? (
              <RankBars
                label="Pares de tags más frecuentes"
                data={pairs.map((p) => ({ label: `${p.pair[0]} + ${p.pair[1]}`, value: p.count }))}
                labelWidth={200}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No hay muestras con dos o más tags.</p>
            )}
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">
              Selección al azar de {hyp.draws} muestras (hipergeométrica)
            </h3>
            <p className="mb-2 text-sm text-muted-foreground">
              De {num(hyp.population)} muestras hay {num(hyp.successes)} de {hyp.family}. Al escoger{" "}
              {hyp.draws} sin reemplazo, P(k de {hyp.family}) = C({hyp.successes}, k) · C(
              {hyp.population - hyp.successes}, {hyp.draws}−k) / C({hyp.population}, {hyp.draws}).
            </p>
            <PmfChart
              label={`Distribución hipergeométrica del número de muestras de ${hyp.family} en ${hyp.draws} elegidas`}
              data={hyp.pmf.map((d) => ({ k: d.k, p: d.p }))}
              series={[{ key: "p", label: "P(K = k)", kind: "bar" }]}
              xLabel={`k = nº de ${hyp.family}`}
              height={220}
            />
            <Insight className="mt-2">
              La probabilidad de que al menos una de las {hyp.draws} muestras sea {hyp.family} es{" "}
              <b className="text-foreground">{pct(hyp.p_at_least_one, 2)}</b>.
            </Insight>
          </div>
        </div>
      </Panel>

      <Panel
        id="calculadora"
        index={4}
        title="Calculadora combinatoria"
        hint="Escribe n y k: un server action los valida y la API devuelve los enteros exactos."
      >
        <CombCalculator defaultN={counting.dimensions[0]?.cardinality} />
      </Panel>

      <Panel index={5} title="Qué aporta al problema">
        <Relation>
          <p>
            Antes de hablar de probabilidades hay que contar: el <b>espacio de perfiles</b> (familia ×
            tipo × entrega) es enorme, pero solo una fracción diminuta ocurre, así que un modelo
            razonable no puede tratar todos los perfiles como equiprobables.
          </p>
          <p>
            Los <b>rankings</b> (top-5, podio) son permutaciones: hay n! órdenes posibles y solo uno es
            el real. Los <b>pares de tags</b> son combinaciones: cuentan qué etiquetas suelen ir juntas
            sin importar el orden. La hipergeométrica conecta el conteo con la probabilidad: se
            calcula como casos favorables entre casos posibles, con C(n,k) en ambos lados.
          </p>
        </Relation>
      </Panel>
    </div>
  );
}

export default async function Combinatoria({ searchParams }: { searchParams: Promise<SP> }) {
  const hours = parseHours(await searchParams);
  const res = await getCombinatorics(hours);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        title="Análisis combinatorio"
        lead="Principio de conteo, permutaciones y combinaciones aplicados a perfiles de malware, rankings de familias y pares de tags."
        path="/combinatoria"
        hours={hours}
      />
      {!res.ok ? (
        <>
          <ApiError error={res.error} />
          <div className="mt-6">
            <Panel title="Calculadora combinatoria" hint="Funciona en cuanto la API responda.">
              <CombCalculator />
            </Panel>
          </div>
        </>
      ) : (
        <Report c={res.data} hours={hours} />
      )}
    </main>
  );
}
