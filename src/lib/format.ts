/** Formato numérico en español (México), compartido por servidor y cliente. */

export const num = (x: number, d = 0) =>
  x.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });

export const pct = (x: number | null | undefined, d = 1) =>
  x == null ? "—" : `${(x * 100).toFixed(d)} %`;

/** Probabilidad con cifras significativas (para valores muy pequeños). */
export const prob = (x: number | null | undefined, d = 4) =>
  x == null ? "—" : x === 0 ? "0" : x < 0.0001 ? x.toExponential(2) : x.toFixed(d);

export function bytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${num(n, n % 1 ? 1 : 0)} B`;
  if (n < 1024 ** 2) return `${num(n / 1024, 1)} KB`;
  if (n < 1024 ** 3) return `${num(n / 1024 ** 2, 2)} MB`;
  return `${num(n / 1024 ** 3, 2)} GB`;
}

/** Entero grande (string decimal): con separadores si cabe, notación científica si no. */
export function bigInt(s: string): string {
  if (!/^\d+$/.test(s)) return s;
  if (s.length <= 15) return Number(s).toLocaleString("es-MX");
  return `${s[0]}.${s.slice(1, 4)} × 10^${s.length - 1}`;
}

/** Número de dígitos del entero (para decir "un número de N cifras"). */
export const digits = (s: string) => s.replace(/\D/g, "").length;
