import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Matriz de probabilidades como tabla accesible: el tono ámbar crece con el
 * valor, y el número siempre está escrito (el color nunca es la única señal).
 */
export function HeatTable({
  rows,
  cols,
  values,
  caption,
  corner,
  rowHeader,
  colHeader,
  digits = 1,
  highlightDiagonal = false,
}: {
  rows: string[];
  cols: string[];
  values: (number | null)[][];
  caption: string;
  corner: string;
  rowHeader?: (r: string, i: number) => React.ReactNode;
  colHeader?: (c: string, j: number) => React.ReactNode;
  digits?: number;
  highlightDiagonal?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {corner}
            </th>
            {cols.map((c, j) => (
              <th key={c} scope="col" className="px-2 py-2 text-center font-medium">
                {colHeader ? colHeader(c, j) : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r} className="border-t border-border">
              <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium">
                {rowHeader ? rowHeader(r, i) : r}
              </th>
              {cols.map((c, j) => {
                const v = values[i]?.[j] ?? null;
                return (
                  <td
                    key={c}
                    className={cn(
                      "px-2 py-2 text-center tabular-nums",
                      highlightDiagonal && i === j && "font-semibold",
                    )}
                    style={
                      v == null
                        ? undefined
                        : { backgroundColor: `oklch(0.83 0.165 78 / ${(Math.min(v, 1) * 0.5).toFixed(2)})` }
                    }
                  >
                    {v == null ? "—" : pct(v, digits)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
