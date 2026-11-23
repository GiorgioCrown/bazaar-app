import Link from "next/link";
import { BazaarError, searchBazaar } from "@/lib/bazaar";
import { analyze, type Analysis } from "@/lib/stats";

type SP = { [key: string]: string | string[] | undefined };

const RANGES = [
  { h: 24, label: "24 horas" },
  { h: 72, label: "3 días" },
  { h: 168, label: "7 días" },
];

const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)} %`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function Report({ a }: { a: Analysis }) {
  const top = a.families.slice(0, 15);
  const maxFam = top[0]?.count ?? 1;
  const maxHour = Math.max(...a.hourly.map((h) => h.count), 1);
  const d = a.dispersion;
  const poissonOk = d ? d.pValue > 0.05 : null;

  return (
    <>
      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Muestras" value={a.total.toLocaleString("es-MX")} hint={`${a.classified} clasificadas · ${a.unclassified} sin firma`} />
        <Stat label="Familias distintas" value={String(a.distinctFamilies)} hint={`Top 5 = ${pct(a.top5Share, 1)}`} />
        <Stat label="Tasa global λ" value={`${a.lambdaTotal.toFixed(1)}/h`} hint={`Ventana: ${a.windowHours.toFixed(1)} h`} />
        <Stat label="Entropía de Shannon" value={`${a.entropy.toFixed(2)} bits`} hint={`Normalizada ${a.entropyNorm.toFixed(2)} · Gini-Simpson ${a.giniSimpson.toFixed(2)}`} />
      </section>
      <p className="mt-2 text-xs text-zinc-500">
        Datos observados del {a.windowStart} al {a.windowEnd} (UTC).
      </p>

      <h2 className="mt-10 text-lg font-semibold">Distribución estadística por familia</h2>
      <div className="mt-3 space-y-1.5">
        {top.map((f) => (
          <div key={f.family} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 truncate" title={f.family}>{f.family}</span>
            <div className="h-4 flex-1 rounded bg-zinc-100 dark:bg-zinc-900">
              <div className="h-4 rounded bg-zinc-800 dark:bg-zinc-200" style={{ width: `${(f.count / maxFam) * 100}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right tabular-nums">{f.count} · {pct(f.p, 1)}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Modelo probabilístico de aparición</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li><b>Multinomial:</b> la probabilidad de que la próxima muestra clasificada sea de la familia <i>i</i> se estima como p<sub>i</sub> = n<sub>i</sub>/N, con intervalo de Wilson al 95 %.</li>
        <li><b>Poisson:</b> las llegadas de cada familia se modelan con tasa λ<sub>i</sub> = n<sub>i</sub>/T (muestras por hora); P(≥1 en t horas) = 1 − e<sup>−λ<sub>i</sub>·t</sup>.</li>
        {d && (
          <li>
            <b>Ajuste Poisson global:</b> índice de dispersión = {d.index.toFixed(2)} (χ² = {d.chi2.toFixed(1)}, gl = {d.df}, p ≈ {d.pValue.toFixed(4)}).{" "}
            {poissonOk
              ? "No se rechaza el modelo de Poisson."
              : d.index > 1
                ? "Se rechaza Poisson simple: hay sobredispersión (las muestras llegan en ráfagas), así que las probabilidades de Poisson son una cota inferior."
                : "Se rechaza Poisson simple: hay subdispersión."}
          </li>
        )}
      </ul>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-300 text-xs uppercase text-zinc-500 dark:border-zinc-700">
            <tr>
              <th className="py-2 pr-4">Familia</th>
              <th className="py-2 pr-4 text-right">Muestras</th>
              <th className="py-2 pr-4 text-right">P(familia)</th>
              <th className="py-2 pr-4 text-right">IC 95 %</th>
              <th className="py-2 pr-4 text-right">λ (por hora)</th>
              <th className="py-2 pr-4 text-right">P(≥1 en 1 h)</th>
              <th className="py-2 text-right">P(≥1 en 24 h)</th>
            </tr>
          </thead>
          <tbody>
            {a.families.slice(0, 50).map((f) => (
              <tr key={f.family} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4">{f.family}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{f.count}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{pct(f.p)}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-zinc-500">{pct(f.ciLow)}–{pct(f.ciHigh)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{f.ratePerHour.toFixed(3)}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{pct(f.pNextHour)}</td>
                <td className="py-2 text-right tabular-nums">{pct(f.pNext24h)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.families.length > 50 && (
          <p className="mt-2 text-xs text-zinc-500">Mostrando 50 de {a.families.length} familias; el CSV incluye todas.</p>
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Patrón temporal (muestras por hora, UTC)</h2>
      <div className="mt-3 flex h-32 items-end gap-px" role="img" aria-label="Muestras por hora">
        {a.hourly.map((h) => (
          <div key={h.hour} title={`${h.hour}: ${h.count}`} className="flex-1 bg-zinc-800 dark:bg-zinc-200" style={{ height: `${(h.count / maxHour) * 100}%`, minHeight: h.count ? 2 : 0 }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>{a.hourly[0]?.hour}</span>
        <span>máx {maxHour}/h</span>
        <span>{a.hourly.at(-1)?.hour}</span>
      </div>

      <h2 className="mt-10 text-lg font-semibold">Tipos de archivo</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {a.fileTypes.slice(0, 8).map((t) => `${t.type} ${pct(t.p, 1)}`).join(" · ")}
      </p>
    </>
  );
}

export default async function Analisis({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.hours) ? sp.hours[0] : sp.hours;
  const hours = Math.min(Math.max(Number(raw) || 168, 1), 168);

  let analysis: Analysis | null = null;
  let error: string | null = null;
  try {
    const res = await searchBazaar("recent", String(hours));
    if (res.query_status !== "ok") error = `La API respondió: ${res.query_status}`;
    else analysis = analyze(res.data ?? []);
  } catch (e) {
    error = e instanceof BazaarError ? e.message : "No se pudo conectar con la API de MalwareBazaar.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link href="/" className="text-sm underline">← Explorador</Link>
      <h1 className="mt-2 text-2xl font-semibold">Análisis probabilístico de malware</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Registros de MalwareBazaar → clasificación por familia → distribución y modelo de aparición.
      </p>

      <nav className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        {RANGES.map((r) => (
          <Link key={r.h} href={`/analisis?hours=${r.h}`} className={`rounded border px-3 py-1.5 ${r.h === hours ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}>
            {r.label}
          </Link>
        ))}
        {analysis && (
          <a href={`/analisis/csv?hours=${hours}`} className="ml-auto rounded border border-zinc-300 px-3 py-1.5 dark:border-zinc-700">
            Descargar CSV
          </a>
        )}
      </nav>

      {error && <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}
      {analysis && analysis.total === 0 && <p className="mt-6 text-sm">Sin muestras en el rango.</p>}
      {analysis && analysis.total > 0 && <Report a={analysis} />}
    </main>
  );
}
