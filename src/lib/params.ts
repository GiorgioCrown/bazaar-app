/** Utilidades de parámetros de URL y validación compartidas (servidor y cliente). */

export type SP = { [key: string]: string | string[] | undefined };

export const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export const DEFAULT_HOURS = 168;
export const MIN_HOURS = 1;
export const MAX_HOURS = 168;

/** Ventana de horas válida (entero 1–168) o `null` si la entrada no sirve. */
export function validHours(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= MIN_HOURS && n <= MAX_HOURS ? n : null;
}

/** Lee `?hours=` con valor por defecto (nunca lanza). */
export function parseHours(sp: SP): number {
  return validHours(first(sp.hours)) ?? DEFAULT_HOURS;
}

/** Rutas a las que `setWindow` puede redirigir (lista blanca). */
export const WINDOW_PATHS = [
  "/analisis",
  "/combinatoria",
  "/estadistica",
  "/probabilidad",
  "/bayes",
  "/variables",
  "/visualizacion",
] as const;

export const RANGES = [
  { h: 24, label: "24 h" },
  { h: 72, label: "3 días" },
  { h: 168, label: "7 días" },
];

/** Campos de evidencia admitidos por /api/bayes. */
export const EVIDENCE_FIELDS = [
  "file_type",
  "delivery_method",
  "clamav",
  "size_band",
  "tag",
] as const;
export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

export const EVIDENCE_LABELS: Record<EvidenceField, string> = {
  file_type: "Tipo de archivo",
  delivery_method: "Método de entrega",
  clamav: "Detección ClamAV",
  size_band: "Tamaño del archivo",
  tag: "Etiqueta (tag)",
};

export const SEARCH_MODES = [
  "recent",
  "hash",
  "tag",
  "signature",
  "file_type",
  "clamav",
] as const;

export const MODE_LABELS: Record<(typeof SEARCH_MODES)[number], string> = {
  recent: "Recientes (horas)",
  hash: "Hash (SHA256/MD5/SHA1)",
  tag: "Tag",
  signature: "Familia (signature)",
  file_type: "Tipo de archivo",
  clamav: "Firma ClamAV",
};

export type SearchMode = (typeof SEARCH_MODES)[number];

export const isSearchMode = (v: unknown): v is SearchMode =>
  typeof v === "string" && (SEARCH_MODES as readonly string[]).includes(v);

/** Valida una búsqueda del explorador. Devuelve el valor normalizado o un error. */
export function validateSearch(
  mode: unknown,
  rawValue: unknown,
  rawLimit: unknown,
):
  | { ok: true; mode: SearchMode; value: string; limit: number }
  | { ok: false; error: string } {
  if (!isSearchMode(mode)) return { ok: false, error: "Tipo de búsqueda no válido." };
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) return { ok: false, error: "Escribe un valor para buscar." };
  if (value.length > 128) return { ok: false, error: "El valor es demasiado largo." };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value))
    return { ok: false, error: "El valor contiene caracteres no válidos." };
  if (mode === "recent" && validHours(value) == null)
    return { ok: false, error: "Las horas deben ser un entero entre 1 y 168." };
  if (mode === "hash" && !/^[a-f0-9]{32}([a-f0-9]{8}|[a-f0-9]{32})?$/i.test(value))
    return {
      ok: false,
      error: "El hash debe ser MD5 (32), SHA1 (40) o SHA256 (64) en hexadecimal.",
    };
  const lim =
    rawLimit === undefined || rawLimit === "" || rawLimit === null
      ? 50
      : Number(rawLimit);
  if (!Number.isInteger(lim) || lim < 1 || lim > 1000)
    return { ok: false, error: "El límite debe ser un entero entre 1 y 1000." };
  return { ok: true, mode, value, limit: lim };
}
