import type { ReactNode } from "react";

/** Tabla compacta accesible usada como alternativa textual de las escenas 3D. */
export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <table className="w-full text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-card text-muted-foreground">
        <tr>
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`px-3 py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            {r.map((c, j) => (
              <td
                key={j}
                className={`px-3 py-1.5 ${j > 0 ? "text-right tabular-nums" : ""}`}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
