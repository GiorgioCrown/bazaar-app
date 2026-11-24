import { bytes as fmtBytes, num } from "@/lib/format";

type Box = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whisker_low: number;
  whisker_high: number;
};

/**
 * Diagrama de caja en SVG (sin dependencias): bigotes, caja Q1-Q3, mediana y
 * extremos. `log` usa escala logarítmica (tamaños de archivo).
 */
export function Boxplot({
  box,
  label,
  unit = "",
  log = false,
}: {
  box: Box;
  label: string;
  unit?: string;
  log?: boolean;
}) {
  const f = (v: number) =>
    unit === "bytes" ? fmtBytes(v) : num(v, v % 1 ? 1 : 0);
  const t = (v: number) => (log ? Math.log10(Math.max(v, 1)) : v);
  const lo = t(box.min);
  const hi = t(box.max);
  const span = hi - lo || 1;
  const W = 640;
  const pad = 36;
  const x = (v: number) => pad + ((t(v) - lo) / span) * (W - pad * 2);
  const cy = 46;
  const ticks = [
    ["Mín", box.min],
    ["Q1", box.q1],
    ["Mediana", box.median],
    ["Q3", box.q3],
    ["Máx", box.max],
  ] as const;
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} 112`}
        role="img"
        aria-label={`Diagrama de caja de ${label}: mínimo ${f(box.min)}, Q1 ${f(box.q1)}, mediana ${f(box.median)}, Q3 ${f(box.q3)}, máximo ${f(box.max)}`}
        className="h-auto w-full"
      >
        <line x1={x(box.whisker_low)} x2={x(box.q1)} y1={cy} y2={cy} stroke="var(--muted-foreground)" strokeWidth="2" />
        <line x1={x(box.q3)} x2={x(box.whisker_high)} y1={cy} y2={cy} stroke="var(--muted-foreground)" strokeWidth="2" />
        <line x1={x(box.whisker_low)} x2={x(box.whisker_low)} y1={cy - 9} y2={cy + 9} stroke="var(--muted-foreground)" strokeWidth="2" />
        <line x1={x(box.whisker_high)} x2={x(box.whisker_high)} y1={cy - 9} y2={cy + 9} stroke="var(--muted-foreground)" strokeWidth="2" />
        <rect
          x={x(box.q1)}
          y={cy - 18}
          width={Math.max(x(box.q3) - x(box.q1), 2)}
          height={36}
          rx="3"
          fill="oklch(0.83 0.165 78 / 0.22)"
          stroke="var(--chart-1)"
          strokeWidth="2"
        />
        <line x1={x(box.median)} x2={x(box.median)} y1={cy - 18} y2={cy + 18} stroke="var(--chart-1)" strokeWidth="4" />
        {[box.min, box.max].map((v, i) => (
          <circle key={i} cx={x(v)} cy={cy} r="4" fill="var(--chart-2)" />
        ))}
        {ticks.map(([name, v], i) => {
          const px = Math.min(Math.max(x(v), 40), W - 40);
          const row = i % 2 === 0 ? 82 : 102;
          return (
            <g key={name}>
              <line x1={x(v)} x2={x(v)} y1={cy + 20} y2={row - 12} stroke="var(--border)" strokeDasharray="2 3" />
              <text x={px} y={row} textAnchor="middle" fontSize="12" fill="var(--foreground)">
                {name}: <tspan fill="var(--muted-foreground)">{f(v)}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      {log && (
        <figcaption className="text-xs text-muted-foreground">
          Escala logarítmica: cada marca avanza por factores, no por sumas.
        </figcaption>
      )}
    </figure>
  );
}
