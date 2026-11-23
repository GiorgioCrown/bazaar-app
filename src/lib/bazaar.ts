import "server-only";

const API_URL = "https://mb-api.abuse.ch/api/v1/";

export type Sample = {
  sha256_hash: string;
  md5_hash?: string;
  sha1_hash?: string;
  first_seen?: string | null;
  last_seen?: string | null;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  file_type_mime?: string;
  reporter?: string;
  signature?: string | null;
  tags?: string[] | null;
  imphash?: string | null;
  tlsh?: string | null;
  ssdeep?: string | null;
  delivery_method?: string | null;
  intelligence?: { clamav?: string[] | null; downloads?: string; uploads?: string };
};

export type BazaarResponse = {
  query_status: string;
  data?: Sample[];
};

export type SearchMode =
  | "recent"
  | "hash"
  | "tag"
  | "signature"
  | "file_type"
  | "clamav";

/** Maps each UI mode to the Bazaar `query` name and its value parameter. */
const MODES: Record<SearchMode, { query: string; param: string }> = {
  recent: { query: "recent_detections", param: "hours" },
  hash: { query: "get_info", param: "hash" },
  tag: { query: "get_taginfo", param: "tag" },
  signature: { query: "get_siginfo", param: "signature" },
  file_type: { query: "get_file_type", param: "file_type" },
  clamav: { query: "get_clamavinfo", param: "clamav" },
};

export const MODE_LABELS: Record<SearchMode, string> = {
  recent: "Recientes (horas, 0-168)",
  hash: "Hash (SHA256 / MD5 / SHA1)",
  tag: "Tag",
  signature: "Firma / familia",
  file_type: "Tipo de archivo",
  clamav: "Firma ClamAV",
};

export function isSearchMode(v: string | undefined): v is SearchMode {
  return !!v && v in MODES;
}

export class BazaarError extends Error {}

export async function searchBazaar(
  mode: SearchMode,
  value: string,
  limit = 50,
): Promise<BazaarResponse> {
  const key = process.env.ABUSECH_AUTH_KEY;
  if (!key) {
    throw new BazaarError(
      "Falta ABUSECH_AUTH_KEY. Créala gratis en https://auth.abuse.ch/ y agrégala a .env.local",
    );
  }

  const { query, param } = MODES[mode];
  const body = new URLSearchParams({ query, [param]: value });
  if (mode !== "recent" && mode !== "hash") {
    body.set("limit", String(Math.min(Math.max(limit, 1), 1000)));
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Auth-Key": key },
    body,
    // Evita servir resultados viejos; la lista cambia constantemente.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new BazaarError(`La API respondió HTTP ${res.status}`);
  }
  return (await res.json()) as BazaarResponse;
}
