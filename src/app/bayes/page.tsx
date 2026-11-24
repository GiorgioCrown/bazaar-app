import { getBayes } from "@/lib/api";
import { parseHours, type SP } from "@/lib/params";
import { PageHeader } from "@/components/window-controls";
import { ApiError, Insight, Panel, Relation } from "@/components/section";
import { BayesLab } from "@/components/bayes-lab";

export const metadata = { title: "Teorema de Bayes · Bazaar Board" };

export default async function Bayes({ searchParams }: { searchParams: Promise<SP> }) {
  const hours = parseHours(await searchParams);
  const res = await getBayes(hours, []);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <PageHeader
        title="Teorema de Bayes"
        lead="Dada una muestra con ciertas características observables, ¿de qué familia es más probable que sea? Actualiza las probabilidades paso a paso."
        path="/bayes"
        hours={hours}
      />
      <div className="mt-8 space-y-6">
        <Panel index={0} topic="Tema 11" title="La regla" hint="Cómo se cambia una creencia al ver evidencia.">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <p className="font-mono text-lg text-primary">P(h | e) = P(e | h) · P(h) / P(e)</p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li><b className="text-foreground">P(h)</b> a priori: la frecuencia de la familia h antes de ver nada.</li>
                <li><b className="text-foreground">P(e | h)</b> verosimilitud: qué tan común es la evidencia e dentro de la familia h.</li>
                <li><b className="text-foreground">P(e)</b> evidencia: qué tan común es e en general (suma sobre todas las familias).</li>
                <li><b className="text-foreground">P(h | e)</b> a posteriori: la probabilidad actualizada.</li>
              </ul>
            </div>
            <Relation>
              <p>
                Un analista recibe un archivo sospechoso y solo conoce rasgos visibles: tipo de archivo,
                cómo llegó, su tamaño, si ClamAV lo detecta o alguna etiqueta. Bayes responde cuál
                familia es más probable <i>dada esa evidencia</i>, usando las frecuencias reales como
                a priori y verosimilitudes.
              </p>
              <p>
                Al encadenar varias evidencias se supone independencia condicional (naive Bayes): es una
                aproximación, útil pero imperfecta.
              </p>
            </Relation>
          </div>
        </Panel>

        <Panel
          index={1}
          id="laboratorio"
          title="Laboratorio interactivo"
          hint="El cálculo lo hace la API con los datos reales; la evidencia se valida en el servidor."
        >
          {!res.ok ? (
            <ApiError error={res.error} />
          ) : (
            <BayesLab initial={res.data} hours={hours} />
          )}
        </Panel>

        <Insight title="Cómo leer los resultados">
          Una evidencia que es mucho más frecuente en una familia que en el total (P(e | h) ≫ P(e)) sube
          fuertemente su probabilidad; una evidencia común a todas las familias casi no la mueve. Por eso
          los rasgos muy específicos (una etiqueta rara) pesan más que los genéricos.
        </Insight>
      </div>
    </main>
  );
}
