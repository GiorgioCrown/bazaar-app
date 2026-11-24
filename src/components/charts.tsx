"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type FamilyDatum = { family: string; count: number; p: number };

const famConfig = {
  count: { label: "Muestras", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Ranked horizontal bars: the leader is lit in amber, the rest are steel. */
export function FamilyBars({ data }: { data: FamilyDatum[] }) {
  return (
    <ChartContainer
      config={famConfig}
      className="aspect-auto w-full"
      style={{ height: data.length * 34 + 16 }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 64, top: 0, bottom: 0 }}
        barCategoryGap={6}
      >
        <YAxis
          type="category"
          dataKey="family"
          tickLine={false}
          axisLine={false}
          width={118}
          tick={{ fill: "var(--foreground)", fontSize: 13 }}
          interval={0}
        />
        <XAxis type="number" hide />
        <ChartTooltip
          cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="font-medium">{item.payload.family}</span>
                  <span className="tabular-nums">
                    {Number(value).toLocaleString("es-MX")} ·{" "}
                    {(item.payload.p * 100).toFixed(1)} %
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="count" radius={3} isAnimationActive>
          {data.map((d, i) => (
            <Cell
              key={d.family}
              fill={
                i === 0
                  ? "var(--chart-1)"
                  : d.family.startsWith("Otras")
                    ? "oklch(0.45 0.015 255)"
                    : "oklch(0.72 0.05 235)"
              }
            />
          ))}
          <LabelList
            dataKey="p"
            position="right"
            offset={8}
            formatter={(v: unknown) => `${(Number(v) * 100).toFixed(1)} %`}
            fill="var(--muted-foreground)"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const hourConfig = {
  count: { label: "Muestras", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function HourlyChart({
  data,
}: {
  data: { hour: string; count: number }[];
}) {
  const step = Math.max(1, Math.ceil(data.length / 7));
  return (
    <ChartContainer config={hourConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: -12, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 0.08)" />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          interval={step - 1}
          tickMargin={8}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5, 10) + " " + v.slice(11)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(v) => `${v} UTC`}
              indicator="dot"
            />
          }
        />
        <Bar
          dataKey="count"
          fill="var(--chart-1)"
          radius={[2, 2, 0, 0]}
          maxBarSize={14}
        />
      </BarChart>
    </ChartContainer>
  );
}
