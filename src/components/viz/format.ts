export const fmtInt = (n: number) => Math.round(n).toLocaleString("es-MX");

export function fmtBytes(b: number): string {
  if (!Number.isFinite(b)) return "–";
  const units = ["B", "KB", "MB", "GB"];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const d = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toLocaleString("es-MX", { maximumFractionDigits: d })} ${units[i]}`;
}

/** "2026-11-23 14:00" → "23/11 14h" */
export function fmtHour(h: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})[ T](\d{2})/.exec(h);
  return m ? `${m[2]}/${m[1]} ${m[3]}h` : h;
}

/** Bordes en bytes; si parecen log10 (todos < 20) se convierten. */
export function edgesToBytes(edges: number[]): number[] {
  const max = Math.max(...edges);
  return max < 20 ? edges.map((e) => 10 ** e) : edges;
}
