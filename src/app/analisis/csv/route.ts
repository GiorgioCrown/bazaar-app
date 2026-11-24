import { getFamilies } from "@/lib/api";
import { parseHours } from "@/lib/params";

const cell = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV de familias: los datos vienen de la API (FastAPI), aquí solo se serializan. */
export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const hours = parseHours(sp);
  const res = await getFamilies(hours);
  if (!res.ok) return new Response(res.error, { status: 502 });

  const header = [
    "familia",
    "muestras",
    "p",
    "ic95_inf",
    "ic95_sup",
    "lambda_por_hora",
    "p_al_menos_1_en_1h",
    "p_al_menos_1_en_24h",
    "primera_vez",
    "ultima_vez",
  ];
  const lines = res.data.families.map((f) =>
    [
      f.family,
      f.count,
      f.p.toFixed(6),
      f.ci_low.toFixed(6),
      f.ci_high.toFixed(6),
      f.rate_per_hour.toFixed(6),
      f.p_next_hour.toFixed(6),
      f.p_next_24h.toFixed(6),
      f.first_seen,
      f.last_seen,
    ]
      .map(cell)
      .join(","),
  );
  return new Response("﻿" + [header.join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="familias_malware_${hours}h.csv"`,
    },
  });
}
