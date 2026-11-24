import Link from "next/link";
import { AlertTriangle, ExternalLink, Search } from "lucide-react";
import {
  BazaarError,
  MODE_LABELS,
  isSearchMode,
  searchBazaar,
  type BazaarResponse,
  type SearchMode,
} from "@/lib/bazaar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const EXAMPLES: { label: string; mode: SearchMode; q: string }[] = [
  { label: "Últimas 24 h", mode: "recent", q: "24" },
  { label: "Familia Mirai", mode: "signature", q: "Mirai" },
  { label: "Familia RemcosRAT", mode: "signature", q: "RemcosRAT" },
  { label: "Archivos ELF", mode: "file_type", q: "elf" },
];

function fmtSize(n?: number) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export default async function Explorador({
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
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <h1 className="text-4xl font-bold sm:text-5xl">Explorador de muestras</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Busca registros concretos en MalwareBazaar por hash, familia, tag o tipo
        de archivo.
      </p>

      <form
        method="GET"
        className="mt-8 grid items-end gap-4 rounded-xl border border-border bg-card p-5 md:grid-cols-[220px_minmax(0,1fr)_110px_auto]"
      >
        <label className="grid gap-1.5 text-sm font-medium">
          Buscar por
          <NativeSelect name="mode" defaultValue={mode} className="w-full">
            {(Object.keys(MODE_LABELS) as SearchMode[]).map((m) => (
              <NativeSelectOption key={m} value={m}>
                {MODE_LABELS[m]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Valor
          <Input
            name="q"
            defaultValue={value}
            placeholder="p. ej. TrickBot, elf, 24"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Límite
          <Input
            name="limit"
            type="number"
            min={1}
            max={1000}
            defaultValue={limit}
          />
        </label>
        <Button type="submit" size="lg" className="h-9 px-5">
          <Search className="size-4" aria-hidden />
          Buscar
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle />
          <AlertTitle>No se pudo completar la búsqueda</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status && status !== "ok" && (
        <Alert className="mt-6 border-primary/40 bg-primary/5">
          <AlertTriangle className="text-primary" />
          <AlertTitle>{ERRORS[status] ?? status}</AlertTitle>
          <AlertDescription>
            Revisa el valor o cambia el tipo de búsqueda.
          </AlertDescription>
        </Alert>
      )}

      {!submitted && (
        <div className="mt-8">
          <p className="text-sm text-muted-foreground">Prueba con:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <Link
                key={e.label}
                href={`/explorador?mode=${e.mode}&q=${encodeURIComponent(e.q)}`}
                className="rounded-full border border-border px-3.5 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
              >
                {e.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {samples.length > 0 && (
        <section className="mt-8">
          <p className="mb-2 text-sm text-muted-foreground">
            {samples.length.toLocaleString("es-MX")} muestra(s)
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>SHA256</TableHead>
                  <TableHead>Familia</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tamaño</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Visto (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {samples.map((s) => (
                  <TableRow key={s.sha256_hash} className="align-top">
                    <TableCell className="font-mono text-xs">
                      <a
                        href={`https://bazaar.abuse.ch/sample/${s.sha256_hash}/`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                      >
                        {s.sha256_hash.slice(0, 16)}…
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </TableCell>
                    <TableCell>
                      {s.signature ? (
                        <Badge variant="secondary">{s.signature}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Sin clasificar</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={s.file_name}>
                      {s.file_name ?? "—"}
                    </TableCell>
                    <TableCell>{s.file_type ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtSize(s.file_size)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.tags?.length
                          ? s.tags.map((t) => (
                              <Badge key={t} variant="outline">
                                {t}
                              </Badge>
                            ))
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.first_seen ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </main>
  );
}
