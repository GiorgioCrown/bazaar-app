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
        lead="Si una muestra tiene ciertos rasgos, ¿de qué familia es más probable que sea? Las probabilidades se actualizan paso a paso."
        path="/bayes"
        hours={hours}
      />
      <div className="mt-8 space-y-6">
        <Panel index={0} topic="Tema 11" title="La regla" hint="Cómo cambia una probabilidad cuando vemos evidencia.">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <p className="font-mono text-lg text-primary">P(h | e) = P(e | h) · P(h) / P(e)</p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li><b className="text-foreground">P(h)</b> a priori (prior): la probabilidad de la familia h antes de ver nada.</li>
                <li><b className="text-foreground">P(e | h)</b> qué tan común es la evidencia e dentro de la familia h.</li>
                <li><b className="text-foreground">P(e)</b> evidencia: qué tan común es e en todas las muestras.</li>
                <li><b className="text-foreground">P(h | e)</b> a posteriori (posterior): la probabilidad ya actualizada.</li>
              </ul>
            </div>
            <Relation>
              <p>
                Llega un archivo sospechoso y solo vemos su tipo, cómo llegó, su tamaño, si ClamAV lo
                detecta o un tag. Bayes dice cuál familia es más probable con esa evidencia.
              </p>
              <p>
                Con varias evidencias se supone que son independientes entre sí. Es una
                aproximación: sirve, pero no es perfecta.
              </p>
            </Relation>
          </div>
        </Panel>

        <Panel
          index={1}
          id="laboratorio"
          title="Laboratorio interactivo"
          hint="Elige evidencias y mira cómo cambian las probabilidades. Los datos son reales."
        >
          {!res.ok ? (
            <ApiError error={res.error} />
          ) : (
            <BayesLab initial={res.data} hours={hours} />
          )}
        </Panel>

        <Insight title="Qué significa">
          Si la evidencia es mucho más común en una familia que en el resto, su probabilidad sube
          bastante. Si es común en todas, casi no la mueve. Un tag raro pesa más que un dato genérico.
        </Insight>
      </div>
    </main>
  );
}
