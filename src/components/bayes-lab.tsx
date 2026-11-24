"use client";

import { useActionState } from "react";
import { FlaskConical } from "lucide-react";
import { runBayes } from "@/app/actions";
import type { BayesState } from "@/lib/action-types";
import type { Bayes } from "@/lib/api-types";
import { EVIDENCE_FIELDS, EVIDENCE_LABELS, type EvidenceField } from "@/lib/params";
import { pct, prob } from "@/lib/format";
import { PriorPosteriorChart } from "@/components/stat-charts";
import { Insight } from "@/components/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const VALUE_LABELS: Record<string, string> = {
  true: "Sí detectada",
  false: "No detectada",
  small: "Pequeño",
  medium: "Mediano",
  large: "Grande",
};

const optLabel = (field: string, v: string) =>
  field === "clamav" || field === "size_band" ? (VALUE_LABELS[v] ?? v) : v;

function describeEvidence(field: string, value: string) {
  const f = EVIDENCE_LABELS[field as EvidenceField] ?? field;
  return `${f} = ${optLabel(field, value)}`;
}

/** Laboratorio de Bayes: el usuario elige evidencias y ve prior → posterior paso a paso. */
export function BayesLab({ initial, hours }: { initial: Bayes; hours: number }) {
  const start: BayesState = { status: "idle", hours, selected: {} };
  const [state, action, pending] = useActionState(runBayes, start);
  const data = state.status === "ok" && state.data ? state.data : initial;
  const steps = data.steps;
  const top = [...data.posterior].sort((a, b) => b.p - a.p)[0];
  const topPrior = data.prior.find((d) => d.hypothesis === top?.hypothesis)?.p ?? 0;

  return (
    <div>
      <form
        action={action}
        key={JSON.stringify(state.selected)}
        className="rounded-lg border border-border bg-background/40 p-4"
      >
        <input type="hidden" name="hours" value={hours} />
        <fieldset>
          <legend className="font-heading text-lg font-semibold">
            Elige la evidencia observada en una muestra nueva
          </legend>
          <p className="mb-3 text-sm text-muted-foreground">
            Cada campo es opcional. Se aplican en orden, de arriba abajo, y cada paso usa el posterior
            anterior como nuevo a priori.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EVIDENCE_FIELDS.map((f) => (
              <label key={f} className="grid gap-1.5 text-sm font-medium">
                {EVIDENCE_LABELS[f]}
                <NativeSelect name={f} defaultValue={state.selected[f] ?? ""} className="w-full">
                  <NativeSelectOption value="">— sin evidencia —</NativeSelectOption>
                  {initial.options[f].map((o) => (
                    <NativeSelectOption key={o} value={o}>
                      {optLabel(f, o)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            <FlaskConical className="size-4" aria-hidden />
            {pending ? "Actualizando…" : "Actualizar probabilidades"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Si dejas todo en blanco verás solo el a priori.
          </span>
        </div>
      </form>

      <div aria-live="polite" className="mt-5 space-y-5">
        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo actualizar</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div>
          <h3 className="mb-1 font-heading text-xl font-semibold">A priori frente a a posteriori</h3>
          <PriorPosteriorChart prior={data.prior} posterior={data.posterior} />
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Ver valores exactos</summary>
            <table className="mt-2 w-full max-w-lg">
              <caption className="sr-only">Probabilidad a priori y a posteriori por familia</caption>
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 font-medium">Familia</th>
                  <th scope="col" className="py-1 text-right font-medium">A priori</th>
                  <th scope="col" className="py-1 text-right font-medium">A posteriori</th>
                </tr>
              </thead>
              <tbody>
                {data.prior.map((d) => (
                  <tr key={d.hypothesis} className="border-t border-border">
                    <th scope="row" className="py-1 text-left font-medium">{d.hypothesis}</th>
                    <td className="py-1 text-right tabular-nums">{pct(d.p, 2)}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">
                      {pct(data.posterior.find((q) => q.hypothesis === d.hypothesis)?.p ?? 0, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        {top && (
          <Insight title={steps.length ? "Conclusión" : "Punto de partida"}>
            {steps.length
              ? `Con la evidencia (${steps.map((s) => describeEvidence(s.evidence.field, s.evidence.value)).join("; ")}), la familia más probable es ${top.hypothesis} con ${pct(top.p, 1)}${top.p > topPrior ? `, frente a ${pct(topPrior, 1)} antes de observar nada (${(top.p / Math.max(topPrior, 1e-9)).toFixed(1)}× más)` : `, frente a ${pct(topPrior, 1)} a priori`}.`
              : `Sin evidencia, la familia más probable es ${top.hypothesis} (${pct(top.p, 1)}), simplemente porque es la más frecuente. Elige evidencias arriba para ver cómo cambia.`}
          </Insight>
        )}

        {steps.map((s, i) => (
          <section
            key={`${s.evidence.field}-${s.evidence.value}`}
            aria-label={`Paso ${i + 1}`}
            className="rounded-lg border border-border bg-card"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <h4 className="font-heading text-lg font-semibold">
                Paso {i + 1}: {describeEvidence(s.evidence.field, s.evidence.value)}
              </h4>
              <p className="text-sm text-muted-foreground">
                P(e) = Σ P(e|h)·P(h) = <b className="text-foreground">{prob(s.marginal)}</b>
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Cálculo bayesiano del paso {i + 1}: a priori, verosimilitud, conjunta y a posteriori
                </caption>
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Familia h</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">P(h)</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">P(e | h)</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">P(e | h)·P(h)</th>
                    <th scope="col" className="px-3 py-2 font-medium">P(h | e) = conjunta / P(e)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {s.rows.map((r) => (
                    <tr key={r.hypothesis}>
                      <th scope="row" className="px-4 py-2 text-left font-medium">{r.hypothesis}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(r.prior, 2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(r.likelihood, 2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{prob(r.joint, 5)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <div className="h-full rounded-full bg-primary" style={{ width: `${r.posterior * 100}%` }} />
                          </div>
                          <span className="w-16 text-right font-semibold tabular-nums">{pct(r.posterior, 2)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="text-sm text-muted-foreground">{data.note}</p>
      </div>
    </div>
  );
}
