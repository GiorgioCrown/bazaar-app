import type { Bayes, CombCalc } from "@/lib/api-types";

/** Estado devuelto por `runBayes` (useActionState). */
export type BayesState = {
  status: "idle" | "ok" | "error";
  error?: string;
  hours: number;
  /** Evidencia elegida por campo ("" = ninguna). */
  selected: Record<string, string>;
  data?: Bayes;
};

/** Estado devuelto por `runCombinatorics` (useActionState). */
export type CombState = {
  status: "idle" | "ok" | "error";
  error?: string;
  n: string;
  k: string;
  data?: CombCalc;
};
