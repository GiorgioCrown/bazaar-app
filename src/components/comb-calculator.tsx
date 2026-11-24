"use client";

import { useActionState } from "react";
import { Calculator } from "lucide-react";
import { runCombinatorics } from "@/app/actions";
import type { CombState } from "@/lib/action-types";
import { bigInt, digits } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** k! exacto con BigInt (k ≤ 300); para k mayores solo se indica el orden de magnitud. */
function kFactorial(k: number): string {
  if (k > 300) return "un número enorme";
  let f = BigInt(1);
  for (let i = 2; i <= k; i++) f *= BigInt(i);
  return bigInt(f.toString());
}

const INITIAL: CombState = { status: "idle", n: "10", k: "3" };

/** Calculadora n, k: P(n,k), C(n,k), n^k y n! calculados por la API (enteros exactos). */
export function CombCalculator({ defaultN }: { defaultN?: number }) {
  const [state, action, pending] = useActionState(runCombinatorics, {
    ...INITIAL,
    n: String(defaultN ?? INITIAL.n),
  });
  const d = state.data;
  const rows = d
    ? [
        {
          name: "Permutaciones P(n, k)",
          formula: "n! / (n − k)!",
          note: "Importa el orden y no se repite.",
          v: d.permutations,
        },
        {
          name: "Combinaciones C(n, k)",
          formula: "n! / (k! (n − k)!)",
          note: "No importa el orden.",
          v: d.combinations,
        },
        {
          name: "Con repetición nᵏ",
          formula: "n · n · … · n (k veces)",
          note: "Importa el orden y se puede repetir.",
          v: d.permutations_with_repetition,
        },
        { name: "Factorial n!", formula: "n · (n−1) · … · 1", note: "Ordenar los n elementos.", v: d.factorial_n },
      ]
    : [];
  return (
    <div>
      <form action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1.5 text-sm font-medium">
          n (elementos disponibles, 1–5000)
          <Input
            name="n"
            type="number"
            inputMode="numeric"
            min={1}
            max={5000}
            step={1}
            required
            defaultValue={state.n}
            key={`n-${state.n}`}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          k (elementos elegidos, 0 ≤ k ≤ n)
          <Input
            name="k"
            type="number"
            inputMode="numeric"
            min={0}
            max={5000}
            step={1}
            required
            defaultValue={state.k}
            key={`k-${state.k}`}
          />
        </label>
        <Button type="submit" disabled={pending} className="h-8">
          <Calculator className="size-4" aria-hidden />
          {pending ? "Calculando…" : "Calcular"}
        </Button>
      </form>

      <div aria-live="polite" className="mt-4">
        {state.status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo calcular</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {d && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Resultados para n = {d.n} y k = {d.k}
              </caption>
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Cantidad</th>
                  <th scope="col" className="px-3 py-2 font-medium">Fórmula</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Resultado exacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.name}>
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {r.name}
                      <span className="block text-xs font-normal text-muted-foreground">{r.note}</span>
                    </th>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.formula}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="font-semibold">{bigInt(r.v)}</span>
                      <span className="block text-xs text-muted-foreground">{digits(r.v)} cifras</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d && (
          <p className="mt-3 text-sm text-muted-foreground">
            Con n = {d.n} y k = {d.k}: hay {bigInt(d.combinations)} formas de escoger {d.k} elementos sin
            importar el orden y {bigInt(d.permutations)} si el orden importa; la razón entre ambas es k! =
            {" "}
            {kFactorial(d.k)}            .
          </p>
        )}
      </div>
    </div>
  );
}
