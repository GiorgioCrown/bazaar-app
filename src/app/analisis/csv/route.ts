import { BazaarError, searchBazaar } from "@/lib/bazaar";
import { analyze, familiesToCsv } from "@/lib/stats";

export async function GET(request: Request) {
  const hours = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("hours")) || 168, 1),
    168,
  );
  try {
    const res = await searchBazaar("recent", String(hours));
    if (res.query_status !== "ok") {
      return new Response(`Sin datos: ${res.query_status}`, { status: 502 });
    }
    return new Response("﻿" + familiesToCsv(analyze(res.data ?? [])), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="familias_malware_${hours}h.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof BazaarError ? e.message : "Error al consultar la API";
    return new Response(msg, { status: 502 });
  }
}
