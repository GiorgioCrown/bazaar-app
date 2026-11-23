import Link from "next/link";
import {
  BazaarError,
  MODE_LABELS,
  isSearchMode,
  searchBazaar,
  type BazaarResponse,
  type SearchMode,
} from "@/lib/bazaar";

type SP = { [key: string]: string | string[] | undefined };

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const ERRORS: Record<string, string> = {
  no_api_key: "No se envió la API key.",
  user_blacklisted: "La API key está bloqueada.",
  hash_not_found: "No se encontró ese hash.",
  illegal_hash: "El hash no es válido.",
  tag_not_found: "No se encontró ese tag.",
  signature_not_found: "No se encontró esa firma.",
  illegal_hours: "Las horas deben estar entre 0 y 168.",
  no_results: "Sin resultados.",
};

function fmtSize(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const modeParam = first(sp.mode);
  const mode: SearchMode = isSearchMode(modeParam) ? modeParam : "recent";
  const value = (first(sp.q) ?? (mode === "recent" ? "24" : "")).trim();
  const limit = Number(first(sp.limit)) || 50;
  const submitted = sp.mode !== undefined;

  let result: BazaarResponse | null = null;
  let error: string | null = null;

  if (submitted && value) {
    try {
      result = await searchBazaar(mode, value, limit);
    } catch (e) {
      error =
        e instanceof BazaarError
          ? e.message
          : "No se pudo conectar con la API de MalwareBazaar.";
    }
  }

  const status = result?.query_status;
  const samples = status === "ok" ? (result?.data ?? []) : [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">MalwareBazaar Explorer</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Consulta muestras de malware vía la API de abuse.ch.
      </p>

      <Link
        href="/analisis"
        className="mt-4 inline-block text-sm underline"
      >
        Ver análisis probabilístico de familias →
      </Link>

      <form className="mt-6 flex flex-wrap items-end gap-3" method="GET">
        <label className="flex flex-col gap-1 text-sm">
          Búsqueda
          <select
            name="mode"
            defaultValue={mode}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          >
            {(Object.keys(MODE_LABELS) as SearchMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
          Valor
          <input
            name="q"
            defaultValue={value}
            placeholder="p. ej. TrickBot, elf, 24"
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <label className="flex w-24 flex-col gap-1 text-sm">
          Límite
          <input
            name="limit"
            type="number"
            min={1}
            max={1000}
            defaultValue={limit}
            className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Buscar
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {status && status !== "ok" && (
        <p className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {ERRORS[status] ?? status}
        </p>
      )}

      {samples.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <p className="mb-2 text-sm text-zinc-500">
            {samples.length} muestra(s)
          </p>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-300 text-xs uppercase text-zinc-500 dark:border-zinc-700">
              <tr>
                <th className="py-2 pr-4">SHA256</th>
                <th className="py-2 pr-4">Firma</th>
                <th className="py-2 pr-4">Archivo</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Tamaño</th>
                <th className="py-2 pr-4">Tags</th>
                <th className="py-2">Visto (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => (
                <tr
                  key={s.sha256_hash}
                  className="border-b border-zinc-200 align-top dark:border-zinc-800"
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    <a
                      href={`https://bazaar.abuse.ch/sample/${s.sha256_hash}/`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline"
                    >
                      {s.sha256_hash.slice(0, 16)}…
                    </a>
                  </td>
                  <td className="py-2 pr-4">{s.signature ?? "—"}</td>
                  <td className="max-w-48 truncate py-2 pr-4">
                    {s.file_name ?? "—"}
                  </td>
                  <td className="py-2 pr-4">{s.file_type ?? "—"}</td>
                  <td className="py-2 pr-4">{fmtSize(s.file_size)}</td>
                  <td className="py-2 pr-4">{s.tags?.join(", ") ?? "—"}</td>
                  <td className="py-2 whitespace-nowrap">
                    {s.first_seen ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
