import { getFamilies } from "@/lib/api";
import { parseHours } from "@/lib/params";

const cell = (v: string | number | null) => {
  let s = v == null ? "" : String(v);
  // Evita inyección de fórmulas al abrir el CSV en Excel/Sheets.
  if (typeof v === "string" && /^[=+@-]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV de familias: los datos vienen de la API (FastAPI), aquí solo se serializan. */
export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const hours = parseHours(sp);
  const res = await getFamilies(hours);
  if (!res.ok) return new Response(res.error, { status: 502 });

  const header = ["familia", "muestras", "probabilidad", "primera_vez", "ultima_vez"];
  const lines = res.data.families.map((f) =>
    [f.family, f.count, f.p.toFixed(6), f.first_seen, f.last_seen]
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
