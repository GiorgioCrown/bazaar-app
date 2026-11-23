import type { Sample } from "./bazaar";

export const UNCLASSIFIED = "Sin clasificar";

export type FamilyStat = {
  family: string;
  count: number;
  /** Probabilidad empírica P(familia) = count / n */
  p: number;
  /** Intervalo de Wilson al 95 % para p */
  ciLow: number;
  ciHigh: number;
  /** Tasa de aparición λ (muestras por hora) */
  ratePerHour: number;
  /** P(al menos una aparición en la siguiente hora) = 1 - e^(-λ) */
  pNextHour: number;
  /** P(al menos una aparición en las siguientes 24 h) */
  pNext24h: number;
  /** Primera / última vez vista en la ventana */
  firstSeen: string | null;
  lastSeen: string | null;
};

export type Analysis = {
  total: number;
  classified: number;
  unclassified: number;
  windowHours: number;
  windowStart: string | null;
  windowEnd: string | null;
  families: FamilyStat[];
  distinctFamilies: number;
  /** Entropía de Shannon (bits) sobre las familias clasificadas */
  entropy: number;
  /** Entropía normalizada 0-1 (1 = distribución uniforme) */
  entropyNorm: number;
  /** Índice de Gini-Simpson: prob. de que 2 muestras al azar sean de familias distintas */
  giniSimpson: number;
  top5Share: number;
  /** Muestras por hora (modelo de llegadas de Poisson global) */
  lambdaTotal: number;
  hourly: { hour: string; count: number }[];
  dispersion: { index: number; chi2: number; df: number; pValue: number } | null;
  fileTypes: { type: string; count: number; p: number }[];
};

function parseUtc(s?: string | null): number | null {
  if (!s) return null;
  // Formato de la API: "2026-11-18 23:49:06 UTC"
  const t = Date.parse(s.replace(/\s*UTC$/, "").replace(" ", "T") + "Z");
  return Number.isNaN(t) ? null : t;
}

const fmtUtc = (t: number) =>
  new Date(t).toISOString().slice(0, 16).replace("T", " ");

/** Intervalo de Wilson para una proporción binomial (z = 1.96). */
function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 0];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** CDF normal estándar (Abramowitz-Stegun). */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** P(X >= chi2) para chi-cuadrada con df grados (aprox. Wilson-Hilferty). */
function chi2Upper(chi2: number, df: number): number {
  if (df <= 0) return NaN;
  const z =
    (Math.pow(chi2 / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return 1 - normCdf(z);
}

export function analyze(samples: Sample[]): Analysis {
  const total = samples.length;
  const times = samples
    .map((s) => parseUtc(s.first_seen))
    .filter((t): t is number => t !== null);

  const tMin = times.length ? Math.min(...times) : null;
  const tMax = times.length ? Math.max(...times) : null;
  // Ventana observada real (la API puede truncar), mínimo 1 h para evitar λ infinita.
  const windowHours =
    tMin !== null && tMax !== null ? Math.max((tMax - tMin) / 3_600_000, 1) : 1;

  // --- Clasificación por familia (campo `signature` de MalwareBazaar) ---
  const groups = new Map<string, Sample[]>();
  let unclassified = 0;
  for (const s of samples) {
    const fam = s.signature?.trim();
    if (!fam) {
      unclassified++;
      continue;
    }
    const arr = groups.get(fam);
    if (arr) arr.push(s);
    else groups.set(fam, [s]);
  }
  const classified = total - unclassified;

  const families: FamilyStat[] = [...groups.entries()]
    .map(([family, list]) => {
      const count = list.length;
      const [ciLow, ciHigh] = wilson(count, classified);
      const ratePerHour = count / windowHours;
      const ts = list
        .map((s) => parseUtc(s.first_seen))
        .filter((t): t is number => t !== null);
      return {
        family,
        count,
        p: count / classified,
        ciLow,
        ciHigh,
        ratePerHour,
        pNextHour: 1 - Math.exp(-ratePerHour),
        pNext24h: 1 - Math.exp(-ratePerHour * 24),
        firstSeen: ts.length ? fmtUtc(Math.min(...ts)) : null,
        lastSeen: ts.length ? fmtUtc(Math.max(...ts)) : null,
      };
    })
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));

  // --- Diversidad ---
  let entropy = 0;
  let simpson = 0;
  for (const f of families) {
    entropy -= f.p * Math.log2(f.p);
    simpson += f.p * f.p;
  }
  const entropyNorm = families.length > 1 ? entropy / Math.log2(families.length) : 0;
  const top5Share = families.slice(0, 5).reduce((a, f) => a + f.p, 0);

  // --- Serie por hora + prueba de dispersión (¿llegadas ~ Poisson?) ---
  const buckets = new Map<number, number>();
  for (const t of times) {
    const h = Math.floor(t / 3_600_000);
    buckets.set(h, (buckets.get(h) ?? 0) + 1);
  }
  const hourly: Analysis["hourly"] = [];
  let dispersion: Analysis["dispersion"] = null;
  if (tMin !== null && tMax !== null) {
    const h0 = Math.floor(tMin / 3_600_000);
    const h1 = Math.floor(tMax / 3_600_000);
    for (let h = h0; h <= h1; h++) {
      hourly.push({ hour: fmtUtc(h * 3_600_000), count: buckets.get(h) ?? 0 });
    }
    const k = hourly.length;
    if (k > 2) {
      const mean = hourly.reduce((a, b) => a + b.count, 0) / k;
      const varSum = hourly.reduce((a, b) => a + (b.count - mean) ** 2, 0);
      if (mean > 0) {
        const chi2 = varSum / mean;
        dispersion = {
          index: varSum / (k - 1) / mean,
          chi2,
          df: k - 1,
          pValue: chi2Upper(chi2, k - 1),
        };
      }
    }
  }

  // --- Tipos de archivo ---
  const ft = new Map<string, number>();
  for (const s of samples) {
    const t = s.file_type?.trim() || "desconocido";
    ft.set(t, (ft.get(t) ?? 0) + 1);
  }
  const fileTypes = [...ft.entries()]
    .map(([type, count]) => ({ type, count, p: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    classified,
    unclassified,
    windowHours,
    windowStart: tMin !== null ? fmtUtc(tMin) : null,
    windowEnd: tMax !== null ? fmtUtc(tMax) : null,
    families,
    distinctFamilies: families.length,
    entropy,
    entropyNorm,
    giniSimpson: 1 - simpson,
    top5Share,
    lambdaTotal: total / windowHours,
    hourly,
    dispersion,
    fileTypes,
  };
}

export function familiesToCsv(a: Analysis): string {
  const rows = [
    [
      "familia",
      "muestras",
      "probabilidad",
      "ic95_inferior",
      "ic95_superior",
      "tasa_por_hora",
      "p_aparicion_1h",
      "p_aparicion_24h",
      "primera_vez_utc",
      "ultima_vez_utc",
    ],
    ...a.families.map((f) => [
      f.family,
      f.count,
      f.p.toFixed(6),
      f.ciLow.toFixed(6),
      f.ciHigh.toFixed(6),
      f.ratePerHour.toFixed(4),
      f.pNextHour.toFixed(6),
      f.pNext24h.toFixed(6),
      f.firstSeen ?? "",
      f.lastSeen ?? "",
    ]),
  ];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
