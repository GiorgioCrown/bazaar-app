"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fmtHour } from "./format";
import { DataTable } from "./data-table";

export type TrendPoint = { hour: string; count: number; moving_avg: number };

const config = {
  count: { label: "Muestras por hora", color: "var(--chart-2)" },
  moving_avg: { label: "Media móvil (3 h)", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** Barras por hora + línea de media móvil (2D, recharts). */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">Sin datos de tendencia.</p>;
  }
  const step = Math.max(1, Math.ceil(data.length / 8));
  const rows = data.map((d) => ({ ...d, moving_avg: +d.moving_avg.toFixed(2) }));
  return (
    <div>
      <div
        role="img"
        aria-label={`Tendencia por hora: ${data.length} horas, entre ${Math.min(...data.map((d) => d.count))} y ${Math.max(...data.map((d) => d.count))} muestras por hora, con media móvil de 3 horas.`}
      >
        <ChartContainer config={config} className="aspect-auto h-64 w-full sm:h-72">
          <ComposedChart data={rows} margin={{ left: -12, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 0.08)" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              interval={step - 1}
              tickMargin={8}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: string) => fmtHour(v)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <ChartTooltip
              cursor={{ fill: "oklch(1 0 0 / 0.05)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => fmtHour(String(p?.[0]?.payload?.hour ?? ""))}
                />
              }
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              fillOpacity={0.55}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              dataKey="moving_avg"
              type="monotone"
              stroke="var(--color-moving_avg)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-chart-2/60" />
          Muestras por hora
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-chart-1" />
          Media móvil de 3 h
        </li>
      </ul>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Ver los datos en tabla
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border">
          <DataTable
            caption="Muestras por hora y media móvil"
            head={["Hora (UTC)", "Muestras", "Media móvil 3 h"]}
            rows={data.map((d) => [
              fmtHour(d.hour),
              d.count.toLocaleString("es-MX"),
              d.moving_avg.toLocaleString("es-MX", { maximumFractionDigits: 1 }),
            ])}
          />
        </div>
      </details>
    </div>
  );
}
