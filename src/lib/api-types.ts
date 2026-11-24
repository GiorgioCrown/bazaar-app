/**
 * Tipos de las respuestas de la API FastAPI (ver docs/api-contract.md).
 * Solo tipos: seguro de importar desde Server y Client Components.
 * Enteros enormes viajan como string decimal (`BigIntStr`).
 */
export type BigIntStr = string;

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

export type SearchMode =
  | "recent"
  | "hash"
  | "tag"
  | "signature"
  | "file_type"
  | "clamav";

export type SearchResponse = { query_status: string; data?: Sample[] };

export type Health = { status: "ok"; offline: boolean; rows_cached: number };

export type Overview = {
  total: number;
  classified: number;
  unclassified: number;
  window_hours_requested: number;
  window_hours_observed: number;
  window_start: string | null; // "YYYY-MM-DD HH:MM" UTC
  window_end: string | null;
  distinct_families: number;
  lambda_total: number; // muestras/hora
  offline: boolean;
  fetched_at: string; // ISO
  /** Muestras con metadatos completos (tamaño, tipo, tags, ClamAV…) */
  enriched: number;
  enriched_fraction: number;
};

/* ---------- Familias (migrado de stats.ts) ---------- */
export type FamilyStat = {
  family: string;
  count: number;
  p: number;
  ci_low: number;
  ci_high: number;
  rate_per_hour: number;
  p_next_hour: number;
  p_next_24h: number;
  first_seen: string | null;
  last_seen: string | null;
};
export type Families = {
  families: FamilyStat[];
  entropy: number;
  entropy_norm: number;
  gini_simpson: number;
  top5_share: number;
  hourly: { hour: string; count: number }[];
  dispersion: { index: number; chi2: number; df: number; p_value: number } | null;
  file_types: { type: string; count: number; p: number }[];
};

/* ---------- 5. Combinatoria ---------- */
export type CombItem = {
  id: string;
  title: string;
  formula: string; // texto plano, p. ej. "P(n,k) = n! / (n-k)!"
  inputs: Record<string, number | string>;
  result: BigIntStr;
  log10: number;
  explanation: string; // en español, ligada a los datos
};
export type Combinatorics = {
  counting: {
    dimensions: { name: string; cardinality: number; values_sample: string[] }[];
    possible_profiles: BigIntStr;
    observed_profiles: number;
    observed_fraction: number;
    top_profiles: { profile: string; count: number }[];
    items: CombItem[];
  };
  permutations: {
    items: CombItem[];
    observed_podium: { family: string; count: number }[];
  };
  combinations: {
    items: CombItem[];
    tag_pairs: { pair: [string, string]; count: number }[];
    hypergeometric: {
      population: number;
      successes: number;
      draws: number;
      family: string;
      p_at_least_one: number;
      pmf: { k: number; p: number }[];
    };
  };
};
export type CombCalc = {
  n: number;
  k: number;
  permutations: BigIntStr; // P(n,k)
  combinations: BigIntStr; // C(n,k)
  permutations_with_repetition: BigIntStr; // n^k
  factorial_n: BigIntStr;
  log10: { permutations: number; combinations: number };
};

/* ---------- 6. Estadística descriptiva ---------- */
export type VarKey = "file_size" | "hourly_count" | "family_count" | "n_tags";
export type Histogram = {
  edges: number[]; // longitud bins+1 (para file_size: en bytes, bins log10)
  counts: number[];
  density: number[];
  scale: "linear" | "log";
};
export type DescVar = {
  key: VarKey;
  label: string;
  unit: string;
  kind: "discrete" | "continuous";
  n: number;
  mean: number;
  median: number;
  modes: number[];
  mode_count: number;
  std: number; // muestral, ddof=1
  variance: number;
  min: number;
  max: number;
  range: number;
  cv: number | null;
  skewness: number | null;
  kurtosis: number | null;
  histogram: Histogram;
  outliers: { count: number; fence_low: number; fence_high: number };
};
export type Descriptive = { variables: DescVar[] };

/* ---------- 7. Medidas de posición ---------- */
export type PositionVar = {
  key: VarKey;
  label: string;
  unit: string;
  quartiles: { q1: number; q2: number; q3: number; iqr: number };
  deciles: Record<`d${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`, number>;
  percentiles: { p: number; value: number }[]; // p = 1..99
  highlights: { p90: number; p95: number; p99: number };
  boxplot: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    whisker_low: number;
    whisker_high: number;
  };
  rank_examples: { label: string; value: number; percentile_rank: number }[];
};
export type Positions = { variables: PositionVar[] };

/* ---------- 8–10. Probabilidad ---------- */
export type EventInfo = {
  id: "A" | "B" | "C" | "D" | "E" | "F";
  name: string;
  description: string;
  count: number;
  p: number;
};
export type AxiomCheck = { name: string; passed: boolean; detail: string };
export type IndependencePair = {
  a: EventInfo["id"];
  b: EventInfo["id"];
  p_a: number;
  p_b: number;
  p_ab: number;
  p_a_times_p_b: number;
  abs_diff: number;
  lift: number | null;
  chi2: number | null;
  /** p-valor de la prueba indicada en `test` (null si degenerate) */
  p_value: number | null;
  independent: boolean;
  /** chi2 de Pearson; fisher si alguna esperada < 5 (chi2 no fiable); degenerate si P(A) o P(B) es 0 o 1 */
  test: "chi2" | "fisher" | "degenerate";
  /** menor frecuencia esperada de la tabla 2x2 (null si degenerate) */
  min_expected: number | null;
};
export type Probability = {
  n: number;
  /** denominador Ω y advertencia de sesgo por enriquecimiento parcial */
  note: string;
  events: EventInfo[];
  axioms: { checks: AxiomCheck[]; partition_sum: number };
  independence: IndependencePair[];
  conditional: {
    events: EventInfo["id"][];
    /** matrix[i][j] = P(events[i] | events[j]); null si P(events[j]) = 0 */
    matrix: (number | null)[][];
    family_given_file_type: {
      families: string[];
      file_types: string[];
      /** p[i][j] = P(families[i] | file_types[j]) */
      p: number[][];
      /** conteo de muestras por file_type (denominadores) */
      file_type_counts: number[];
    };
  };
};

/* ---------- 11. Bayes ---------- */
export type BayesEvidence = { field: string; value: string };
export type BayesRow = {
  hypothesis: string;
  prior: number;
  likelihood: number; // P(e | h)
  joint: number; // P(e | h) · P(h)
  posterior: number;
};
export type BayesStep = {
  evidence: BayesEvidence;
  marginal: number; // P(e) bajo el modelo actual
  rows: BayesRow[];
};
export type Bayes = {
  hypotheses: string[]; // top 8 + "Otras"
  prior: { hypothesis: string; p: number }[];
  steps: BayesStep[];
  posterior: { hypothesis: string; p: number }[]; // = prior si no hay pasos
  note: string; // supuesto naive Bayes, tamaño de muestra, etc.
  options: {
    file_type: string[];
    delivery_method: string[];
    clamav: string[];
    size_band: string[];
    tag: string[];
  };
};

/* ---------- 12. Variables aleatorias ---------- */
export type RvBase = {
  id: "X" | "Y" | "Z";
  name: string;
  description: string;
  kind: "discrete" | "continuous";
  support: string;
  mean: number;
  variance: number;
};
export type RvDiscrete = RvBase & {
  kind: "discrete";
  /** pmf empírica vs. modelo */
  pmf: { k: number; empirical: number; poisson: number; neg_binomial?: number }[];
  lambda: number;
  dispersion_index: number;
  gof: { chi2: number; df: number; p_value: number; model: string } | null;
  tail: { k: number; p_equal: number; p_at_least: number }[];
};
export type RvContinuous = RvBase & {
  kind: "continuous";
  lognormal: { mu: number; sigma: number };
  /** curvas sobre x (bytes) */
  curve: { x: number; pdf_log: number; cdf_empirical: number; cdf_model: number }[];
  histogram: Histogram;
  ks: { statistic: number; p_value: number };
  probabilities: { label: string; p_model: number; p_empirical: number }[];
};
export type RandomVariables = {
  X: RvDiscrete;
  Y: RvContinuous;
  Z: RvBase & {
    kind: "discrete";
    pmf: { k: number; empirical: number }[];
  };
};

/* ---------- 13. Visualización ---------- */
export type Viz = {
  families: string[]; // top 8
  hours: string[]; // "YYYY-MM-DD HH:00"
  family_hour_matrix: number[][]; // [familia][hora]
  size_histogram: { edges: number[]; counts: number[] };
  percentile_curve: { p: number; value: number }[];
  family_nodes: { id: string; count: number; group: string }[];
  family_links: { source: string; target: string; weight: number }[];
  trend: { hour: string; count: number; moving_avg: number }[];
};
