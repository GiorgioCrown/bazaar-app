import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type {
  Bayes,
  BayesEvidence,
  CombCalc,
  Combinatorics,
  Descriptive,
  Families,
  Health,
  Overview,
  Positions,
  Probability,
  RandomVariables,
  SearchMode,
  SearchResponse,
} from "@/lib/api-types";

/**
 * Cliente tipado de la API FastAPI. Solo corre en el servidor (RSC, server
 * actions, route handlers). La clave de abuse.ch nunca llega aquí: la lee Python.
 */
const API_URL = (process.env.API_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const DOWN =
  "No se pudo conectar con la API de análisis (FastAPI). Verifica que esté corriendo con `npm run api`.";

/**
 * GET cacheado 5 min y etiquetado "bazaar" (revalidable con `refreshData`).
 * Lanza Error con un mensaje en español; los envoltorios lo convierten en ApiResult.
 */
async function cachedGet(path: string): Promise<unknown> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag("bazaar");
  return rawGet(path);
}

async function rawGet(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error(DOWN);
  }
  if (!res.ok) {
    let detail = `La API respondió con el código ${res.status}.`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(detail);
  }
  return res.json();
}

async function wrap<T>(run: () => Promise<unknown>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: (await run()) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : DOWN };
  }
}

const qs = (o: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(o).map(([k, v]) => [k, String(v)]),
  ).toString();

export const getHealth = () => wrap<Health>(() => rawGet("/api/health"));
export const getOverview = (hours: number) =>
  wrap<Overview>(() => cachedGet(`/api/overview?hours=${hours}`));
export const getFamilies = (hours: number) =>
  wrap<Families>(() => cachedGet(`/api/families?hours=${hours}`));
export const getCombinatorics = (hours: number) =>
  wrap<Combinatorics>(() => cachedGet(`/api/combinatorics?hours=${hours}`));
export const getDescriptive = (hours: number) =>
  wrap<Descriptive>(() => cachedGet(`/api/descriptive?hours=${hours}`));
export const getPositions = (hours: number) =>
  wrap<Positions>(() => cachedGet(`/api/positions?hours=${hours}`));
export const getProbability = (hours: number) =>
  wrap<Probability>(() => cachedGet(`/api/probability?hours=${hours}`));
export const getRandomVariables = (hours: number) =>
  wrap<RandomVariables>(() => cachedGet(`/api/random-variables?hours=${hours}`));

export const getCombCalc = (n: number, k: number) =>
  wrap<CombCalc>(() => cachedGet(`/api/combinatorics/calc?${qs({ n, k })}`));

export const getBayes = (hours: number, evidence: BayesEvidence[]) => {
  const p = new URLSearchParams({ hours: String(hours) });
  for (const e of evidence) p.append("evidence", `${e.field}:${e.value}`);
  return wrap<Bayes>(() => cachedGet(`/api/bayes?${p.toString()}`));
};

export const getSearch = (mode: SearchMode, value: string, limit: number) =>
  wrap<SearchResponse>(() =>
    cachedGet(`/api/search?${qs({ mode, value, limit })}`),
  );

/** POST /api/snapshot: guarda el último dataset real para el modo offline. */
export async function postSnapshot(): Promise<ApiResult<unknown>> {
  try {
    const res = await fetch(`${API_URL}/api/snapshot`, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { ok: false, error: `La API respondió ${res.status}.` };
    return { ok: true, data: await res.json().catch(() => null) };
  } catch {
    return { ok: false, error: DOWN };
  }
}
