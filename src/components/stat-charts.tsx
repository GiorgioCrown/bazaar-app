"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { Histogram } from "@/lib/api-types";
import { bytes as fmtBytes, num } from "@/lib/format";

const GRID = "oklch(1 0 0 / 0.08)";
const TICK = { fill: "var(--muted-foreground)", fontSize: 11 };
const AMBER = "var(--chart-1)";
const BLUE = "var(--chart-2)";
const PINK = "var(--chart-3)";
const PALETTE = [AMBER, BLUE, PINK];

/* ---------- Histograma ---------- */

export function HistogramChart({
  histogram,
  label,
  unit = "bytes",
  discrete = false,
}: {
  histogram: Histogram;
  label: string;
  unit?: string;
  discrete?: boolean;
}) {
  const { edges, counts, scale } = histogram;
  const fmt = (v: number) =>
    unit === "bytes" ? fmtBytes(v) : num(v, v % 1 ? 1 : 0);
  // Barras centradas en enteros (bordes en x.5): se rotula con el valor entero.
  const centered =
    discrete && edges.every((e) => Math.abs(e * 2 - Math.round(e * 2)) < 1e-9 && e % 1 !== 0);
  const data = counts.map((c, i) => ({
    name: centered ? String((edges[i] + edges[i + 1]) / 2) : fmt(edges[i]),
    range: centered
      ? `valor ${(edges[i] + edges[i + 1]) / 2}`
      : `${fmt(edges[i])} – ${fmt(edges[i + 1])}`,
    count: c,
  }));
  const config = {
    count: { label: "Muestras", color: AMBER },
  } satisfies ChartConfig;
  const step = Math.max(1, Math.ceil(data.length / 8));
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-60 w-full"
      role="img"
      aria-label={`Histograma de ${label}${scale === "log" ? " en escala logarítmica" : ""}`}
    >
      <BarChart
        data={data}
        margin={{ left: -8, right: 8, top: 8 }}
        barCategoryGap={1}
      >
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={TICK}
          interval={step - 1}
          tickMargin={6}
        />
        <YAxis tickLine={false} axisLine={false} width={44} tick={TICK} />
        <ChartTooltip
          cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_v, p) => p?.[0]?.payload?.range}
              indicator="dot"
            />
          }
        />
        <Bar dataKey="count" fill={AMBER} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

/* ---------- Curva de percentiles (ojiva) ---------- */

export function PercentileChart({
  data,
  label,
  log = false,
  unit = "",
  marks = [],
}: {
  data: { p: number; value: number }[];
  label: string;
  log?: boolean;
  unit?: string;
  marks?: { p: number; label: string }[];
}) {
  const fmt = (v: number) =>
    unit === "bytes" ? fmtBytes(v) : num(v, v % 1 ? 1 : 0);
  const config = { value: { label, color: AMBER } } satisfies ChartConfig;
  const safe = log ? data.filter((d) => d.value > 0) : data;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-60 w-full"
      role="img"
      aria-label={`Curva de percentiles de ${label}`}
    >
      <LineChart data={safe} margin={{ left: 4, right: 16, top: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis
          dataKey="p"
          type="number"
          domain={[1, 99]}
          ticks={[1, 10, 25, 50, 75, 90, 99]}
          tickFormatter={(v) => `P${v}`}
          tickLine={false}
          axisLine={false}
          tick={TICK}
        />
        <YAxis
          scale={log ? "log" : "linear"}
          domain={log ? ["auto", "auto"] : [0, "auto"]}
          tickFormatter={(v) => fmt(Number(v))}
          tickLine={false}
          axisLine={false}
          width={64}
          tick={TICK}
          allowDataOverflow
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => `Percentil ${v}`}
              formatter={(v) => (
                <span className="tabular-nums">{fmt(Number(v))}</span>
              )}
              hideIndicator
            />
          }
        />
        {marks.map((m) => (
          <ReferenceLine
            key={m.p}
            x={m.p}
            stroke={BLUE}
            strokeDasharray="4 3"
            label={{
              value: m.label,
              fill: "var(--foreground)",
              fontSize: 11,
              position: "insideTopLeft",
            }}
          />
        ))}
        <Line dataKey="value" stroke={AMBER} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

/* ---------- pmf empírica vs modelo ---------- */

export type PmfSeries = {
  key: string;
  label: string;
  kind: "bar" | "line";
  color?: string;
};

export function PmfChart({
  data,
  series,
  label,
  xLabel,
  height = 260,
}: {
  data: Record<string, number>[];
  series: PmfSeries[];
  label: string;
  xLabel?: string;
  height?: number;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.label, color: s.color ?? PALETTE[i % 3] },
    ]),
  );
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      <ComposedChart
        data={data}
        margin={{ left: -4, right: 8, top: 8, bottom: xLabel ? 16 : 0 }}
      >
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="k"
          tickLine={false}
          axisLine={false}
          tick={TICK}
          interval="preserveStartEnd"
          label={
            xLabel
              ? {
                  value: xLabel,
                  position: "insideBottom",
                  offset: -10,
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                }
              : undefined
          }
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={46}
          tick={TICK}
          tickFormatter={(v) => Number(v).toFixed(2)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => `k = ${v}`}
              formatter={(v, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span>{config[String(name)]?.label ?? name}</span>
                  <span className="tabular-nums">{Number(v).toFixed(4)}</span>
                </div>
              )}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) =>
          s.kind === "bar" ? (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.key}
              fill={s.color ?? PALETTE[i % 3]}
              radius={[2, 2, 0, 0]}
              fillOpacity={0.9}
            />
          ) : (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.key}
              stroke={s.color ?? PALETTE[i % 3]}
              strokeWidth={2.5}
              dot={{ r: 2.5 }}
              type="monotone"
            />
          ),
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

/* ---------- Lognormal: pdf y CDF ---------- */

type Curve = {
  x: number;
  pdf_log: number;
  cdf_empirical: number;
  cdf_model: number;
}[];

export function LognormalPdfChart({
  curve,
  histogram,
}: {
  curve: Curve;
  histogram: Histogram;
}) {
  const total = histogram.counts.reduce((a, b) => a + b, 0) || 1;
  // histograma como densidad sobre log10(bytes): cuentas / (N · ancho del bin)
  const hist = histogram.counts.map((c, i) => {
    const lo = Math.log10(Math.max(histogram.edges[i], 1));
    const hi = Math.log10(Math.max(histogram.edges[i + 1], 1));
    return { lx: (lo + hi) / 2, hist: c / (total * Math.max(hi - lo, 1e-9)) };
  });
  const model = curve
    .filter((c) => c.x > 0)
    .map((c) => ({ lx: Math.log10(c.x), model: c.pdf_log }));
  const data = [...hist, ...model].sort((a, b) => a.lx - b.lx);
  const config = {
    hist: { label: "Datos (densidad)", color: AMBER },
    model: { label: "Lognormal ajustada", color: BLUE },
  } satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-64 w-full"
      role="img"
      aria-label="Densidad del tamaño de archivo: histograma frente al modelo lognormal"
    >
      <ComposedChart data={data} margin={{ left: -4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="lx"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => fmtBytes(10 ** Number(v))}
          tickLine={false}
          axisLine={false}
          tick={TICK}
          tickCount={7}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tick={TICK}
          tickFormatter={(v) => Number(v).toFixed(2)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => `≈ ${fmtBytes(10 ** Number(v))}`}
              formatter={(v, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span>
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="tabular-nums">{Number(v).toFixed(3)}</span>
                </div>
              )}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="hist"
          name="hist"
          fill={AMBER}
          fillOpacity={0.55}
          barSize={10}
        />
        <Line
          dataKey="model"
          name="model"
          stroke={BLUE}
          strokeWidth={2.5}
          dot={false}
          connectNulls
          type="monotone"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

export function CdfChart({ curve }: { curve: Curve }) {
  const data = curve
    .filter((c) => c.x > 0)
    .map((c) => ({
      lx: Math.log10(c.x),
      emp: c.cdf_empirical,
      model: c.cdf_model,
    }));
  const config = {
    emp: { label: "F empírica", color: AMBER },
    model: { label: "F lognormal", color: BLUE },
  } satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-64 w-full"
      role="img"
      aria-label="Función de distribución acumulada empírica frente a la lognormal"
    >
      <LineChart data={data} margin={{ left: -4, right: 8, top: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis
          dataKey="lx"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => fmtBytes(10 ** Number(v))}
          tickLine={false}
          axisLine={false}
          tick={TICK}
          tickCount={7}
        />
        <YAxis
          domain={[0, 1]}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={TICK}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => `≤ ${fmtBytes(10 ** Number(v))}`}
              formatter={(v, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span>
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="tabular-nums">{Number(v).toFixed(3)}</span>
                </div>
              )}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          dataKey="emp"
          name="emp"
          stroke={AMBER}
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          dataKey="model"
          name="model"
          stroke={BLUE}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

/* ---------- Barras horizontales genéricas ---------- */

export type RankDatum = { label: string; value: number };

export function RankBars({
  data,
  label,
  format = (v) => num(v),
  height,
  highlightFirst = true,
  labelWidth = 130,
}: {
  data: RankDatum[];
  label: string;
  format?: (v: number) => string;
  height?: number;
  highlightFirst?: boolean;
  labelWidth?: number;
}) {
  const config = { value: { label, color: AMBER } } satisfies ChartConfig;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: height ?? data.length * 32 + 16 }}
      role="img"
      aria-label={label}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 72, top: 0, bottom: 0 }}
        barCategoryGap={6}
      >
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={labelWidth}
          interval={0}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(v, _n, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="font-medium">{item.payload.label}</span>
                  <span className="tabular-nums">{format(Number(v))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="value" radius={3}>
          {data.map((d, i) => (
            <Cell
              key={d.label}
              fill={
                highlightFirst && i === 0 ? AMBER : "oklch(0.72 0.05 235)"
              }
            />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            offset={8}
            formatter={(v: unknown) => format(Number(v))}
            fill="var(--muted-foreground)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/* ---------- Bayes: a priori vs a posteriori ---------- */

export function PriorPosteriorChart({
  prior,
  posterior,
}: {
  prior: { hypothesis: string; p: number }[];
  posterior: { hypothesis: string; p: number }[];
}) {
  const post = new Map(posterior.map((d) => [d.hypothesis, d.p]));
  const data = prior.map((d) => ({
    h: d.hypothesis,
    prior: d.p,
    posterior: post.get(d.hypothesis) ?? 0,
  }));
  const config = {
    prior: { label: "A priori P(h)", color: BLUE },
    posterior: { label: "A posteriori P(h | evidencia)", color: AMBER },
  } satisfies ChartConfig;
  const pctLabel = (v: unknown) => `${(Number(v) * 100).toFixed(1)} %`;
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: data.length * 46 + 40 }}
      role="img"
      aria-label="Probabilidad de cada familia antes y después de la evidencia"
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 56, top: 0, bottom: 0 }}
        barCategoryGap={8}
      >
        <YAxis
          type="category"
          dataKey="h"
          tickLine={false}
          axisLine={false}
          width={118}
          interval={0}
          tick={{ fill: "var(--foreground)", fontSize: 12 }}
        />
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <ChartTooltip
          cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
          content={
            <ChartTooltipContent
              formatter={(v, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span>{config[name as keyof typeof config]?.label}</span>
                  <span className="tabular-nums">
                    {(Number(v) * 100).toFixed(2)} %
                  </span>
                </div>
              )}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="prior" name="prior" fill={BLUE} radius={3}>
          <LabelList
            dataKey="prior"
            position="right"
            offset={6}
            formatter={pctLabel}
            fill="var(--muted-foreground)"
            fontSize={11}
          />
        </Bar>
        <Bar dataKey="posterior" name="posterior" fill={AMBER} radius={3}>
          <LabelList
            dataKey="posterior"
            position="right"
            offset={6}
            formatter={pctLabel}
            fill="var(--foreground)"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
