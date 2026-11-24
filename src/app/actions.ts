"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import {
  getBayes,
  getCombCalc,
  postSnapshot,
} from "@/lib/api";
import type { BayesEvidence } from "@/lib/api-types";
import type { BayesState, CombState } from "@/lib/action-types";
import {
  DEFAULT_HOURS,
  EVIDENCE_FIELDS,
  WINDOW_PATHS,
  validHours,
  validateSearch,
} from "@/lib/params";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** Cambia la ventana de análisis y vuelve a la misma ruta (lista blanca). */
export async function setWindow(formData: FormData) {
  const path = str(formData.get("path"));
  const target = (WINDOW_PATHS as readonly string[]).includes(path)
    ? path
    : "/analisis";
  const hours = validHours(str(formData.get("hours")));
  redirect(hours ? `${target}?hours=${hours}` : target);
}

/** Invalida la caché "bazaar" y, opcionalmente, guarda un snapshot offline. */
export async function refreshData(formData: FormData) {
  if (str(formData.get("snapshot")) === "on") await postSnapshot();
  updateTag("bazaar");
}

/** Búsqueda del explorador: valida y redirige a la URL compartible. */
export async function searchSamples(formData: FormData) {
  const mode = str(formData.get("mode"));
  const q = str(formData.get("q"));
  const limit = str(formData.get("limit"));
  const v = validateSearch(mode, q, limit);
  const p = new URLSearchParams({ mode, q: q.trim().slice(0, 128) });
  if (limit) p.set("limit", limit.slice(0, 5));
  redirect(`/explorador?${v.ok ? "" : "invalid=1&"}${p.toString()}`);
}

/** Laboratorio de Bayes: evidencia validada contra las opciones reales de la API. */
export async function runBayes(
  prev: BayesState,
  formData: FormData,
): Promise<BayesState> {
  const hours = validHours(str(formData.get("hours"))) ?? DEFAULT_HOURS;
  const selected: Record<string, string> = {};
  for (const f of EVIDENCE_FIELDS) selected[f] = str(formData.get(f)).trim();
  const base = { hours, selected };

  // Opciones válidas = las que la propia API ofrece para esta ventana.
  const opts = await getBayes(hours, []);
  if (!opts.ok) return { status: "error", error: opts.error, ...base };

  const evidence: BayesEvidence[] = [];
  for (const f of EVIDENCE_FIELDS) {
    const value = selected[f];
    if (!value) continue;
    if (!opts.data.options[f].includes(value))
      return {
        status: "error",
        error: `El valor “${value.slice(0, 40)}” no es una opción válida para ${f}.`,
        ...base,
      };
    evidence.push({ field: f, value });
  }
  if (evidence.length > EVIDENCE_FIELDS.length)
    return { status: "error", error: "Demasiada evidencia.", ...base };

  const res = await getBayes(hours, evidence);
  if (!res.ok) return { status: "error", error: res.error, ...base };
  void prev;
  return { status: "ok", data: res.data, ...base };
}

/** Calculadora combinatoria: n y k enteros validados (n ≤ 5000, k ≤ n). */
export async function runCombinatorics(
  prev: CombState,
  formData: FormData,
): Promise<CombState> {
  const rawN = str(formData.get("n")).trim();
  const rawK = str(formData.get("k")).trim();
  const base = { n: rawN, k: rawK };
  if (!/^\d{1,4}$/.test(rawN) || !/^\d{1,4}$/.test(rawK))
    return {
      status: "error",
      error: "n y k deben ser enteros no negativos.",
      ...base,
    };
  const n = Number(rawN);
  const k = Number(rawK);
  if (n < 1 || n > 5000)
    return { status: "error", error: "n debe estar entre 1 y 5000.", ...base };
  if (k > n)
    return { status: "error", error: "k no puede ser mayor que n.", ...base };
  const res = await getCombCalc(n, k);
  void prev;
  if (!res.ok) return { status: "error", error: res.error, ...base };
  return { status: "ok", data: res.data, ...base };
}
