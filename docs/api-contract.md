# Contrato API (FastAPI) ↔ Next.js

Fuente única de verdad entre `api/` (Python) y `src/` (Next.js). Los tipos TS
equivalentes viven en `src/lib/api-types.ts`. Si algo cambia, se cambia AQUÍ y
en ese archivo en el mismo commit.

## Reglas generales
- FastAPI en `http://127.0.0.1:8000`. Next.js lo consume SOLO desde el servidor
  (RSC / server actions / route handlers) con `API_URL` (default arriba).
  El navegador nunca habla con FastAPI ni con abuse.ch. La key
  `ABUSECH_AUTH_KEY` solo la lee Python (de `.env.local` en la raíz del
  proyecto o del entorno).
- Todo el cómputo estadístico es Python (pandas + numpy). Next.js solo presenta
  e interpreta. Solo se usan herramientas del temario (sin Poisson ni
  inferencia); los textos van en palabras simples, aptas para exponer.
- Parámetro común `hours` (1–168, default 168) = ventana de `recent_detections`.
- Respuestas JSON, `snake_case`, floats finitos (nunca NaN/Inf: usar `null`).
- Enteros potencialmente enormes (factoriales, combinaciones) viajan como
  **string** decimal + `log10` como número.
- Errores: HTTP 4xx/5xx con `{"detail": "mensaje en español"}`.
- Modo offline: si `BAZAAR_OFFLINE=1` (o no hay key y existe
  `api/data/snapshot.json`), la API usa el snapshot guardado. `POST
  /api/snapshot` guarda el último dataset real. Los datos NUNCA se inventan;
  el snapshot es una copia de una respuesta real de abuse.ch.
- Caché en memoria 5 min por `hours` para no saturar abuse.ch.

## DataFrame base (`api/app/data.py`, `load_df(hours) -> pd.DataFrame`)
Una fila por muestra. Columnas: `sha256`, `first_seen` (datetime64 UTC),
`family` (str|NA, de `signature`), `file_type`, `file_size` (int),
`delivery_method`, `reporter`, `tags` (list[str]), `n_tags` (int),
`clamav` (bool: tiene firma ClamAV), `hour` (floor a hora UTC).

## Origen real de los datos y enriquecimiento (nota de implementación)
`recent_detections` solo devuelve `sha256`, `first_seen`, `file_name` y `signature`
(familia). Los demás campos del DataFrame se obtienen de la propia API real con
`get_siginfo` (familias con ≥5 muestras), `get_file_type` (20 tipos comunes) y
`get_recent`, uniendo por `sha256` (cobertura ≈ 90-99 %). Las filas sin
metadatos conservan `NA` (columna `enriched=False`); nada se imputa.
- Familias, serie por hora, X (muestras/hora) usan **todas** las filas.
- `file_size`, `file_type`, `delivery_method`, tags, ClamAV, Ω de
  `/api/probability`, `/api/bayes`, `/api/combinatorics` (perfiles), Y y Z usan
  solo las filas enriquecidas (`Overview.enriched`; `Probability.n` es ese Ω).
- `Overview` trae `avg_per_hour` (muestras/hora promedio) y añade `enriched` y `enriched_fraction` (cambio respecto al contrato
  inicial; también en `api-types.ts`).
- Hoy `recent_detections` solo lista muestras con firma, por lo que el evento F
  (sin familia) puede tener conteo 0.

## Endpoints (todos GET salvo indicación)
| Ruta | Sección | Contenido |
|---|---|---|
| `/api/health` | – | `{status, offline, rows_cached}` |
| `/api/overview?hours=` | base | `Overview` |
| `/api/families?hours=` | base | `Families` |
| `/api/search?mode=&value=&limit=` | explorador | proxy tipado de abuse.ch (`recent,hash,tag,signature,file_type,clamav`) → `{query_status, data: Sample[]}` |
| `/api/combinatorics?hours=` | 5 | `Combinatorics` |
| `/api/combinatorics/calc?n=&k=` | 5 | `CombCalc` (n ≤ 5000, k ≤ n) |
| `/api/descriptive?hours=` | 6 | `Descriptive` |
| `/api/positions?hours=` | 7 | `Positions` |
| `/api/probability?hours=` | 8, 9, 10 | `Probability` |
| `/api/bayes?hours=&evidence=campo:valor&evidence=…` | 11 | `Bayes` (evidence repetible; campos: `file_type`, `delivery_method`, `clamav`(`true`/`false`), `size_band`(`small`/`medium`/`large`), `tag`) |
| `/api/random-variables?hours=` | 12 | `RandomVariables` |
| `/api/viz?hours=` | 13 | `Viz` (datos listos para 3D y gráficas) |
| `/api/snapshot` (POST) | – | guarda snapshot |

Ver `src/lib/api-types.ts` para las formas exactas. Resumen de contenido:

### Combinatorics (sección 5)
- `counting`: principio fundamental. Dimensiones observadas
  (`family`, `file_type`, `delivery_method`, `clamav`) con su cardinalidad,
  producto = nº de perfiles posibles, nº de perfiles observados, fracción
  observada, y regla de la suma vs. producto explicada en datos.
- `permutations`: P(F,k) para k=1..5 (F=familias distintas), 5! rankings del
  top-5, y la permutación de un podio top-3 observado.
- `combinations`: C(F,k), C(N,k) muestras, pares de tags (`C(t,2)` posibles
  vs. observados con conteos top).
- Cada bloque trae `formula`, `inputs`, `result` (string) y `log10`.

### Descriptive (sección 6)
Para cada variable (`file_size` continua, `hourly_count` discreta,
`family_count` discreta, `n_tags` discreta): `n, mean, median, modes,
mode_count, std (muestral, ddof=1), variance, min, max, range`,
`histogram` {edges, counts, density, scale:"linear"|"log"} (file_size en
escala log10), y `outliers` (conteo + cercas, regla IQR 1.5).

### Positions (sección 7)
Por variable: `quartiles {q1,q2,q3,iqr}`, `deciles` d1..d9, `percentiles`
(p1..p99 completos para graficar, más p90/p95/p99 destacados), `boxplot`
{min,q1,median,q3,max,whisker_low,whisker_high}, y `rank_examples`: percentil
de valores concretos (p. ej. el tamaño de la muestra mediana, 1 MiB).

### Probability (secciones 8, 9, 10)
`events`: lista de eventos sobre muestras (Ω = todas las muestras de la
ventana): A `exe/dll` (PE), B familia líder, C tamaño > 1 MiB, D con tags,
E detectada por ClamAV, F sin familia (`signature` nulo). Cada uno: `id, name,
description, count, p`.
- `note`: denominador Ω (n de total, % enriquecido) y aviso de sesgo: `get_siginfo` limita a 1000
  muestras por familia, así que familias muy grandes quedan subrepresentadas en Ω.
- `axioms`: `checks[]` {name, passed, detail}: 0≤P≤1 para todo evento,
  P(Ω)=1, suma de la partición por familias (incl. "Sin clasificar") = 1,
  aditividad para eventos disjuntos, complemento, inclusión-exclusión.
- `independence`: todos los pares (i<j): `a, b, p_a, p_b, p_ab,
  p_a_times_p_b, abs_diff, independent`. Regla simple: A y B son
  independientes (aprox.) si `abs_diff = |P(A∩B) − P(A)·P(B)| ≤ 0.01`.
- `conditional`: matriz `P(row | col)` para los eventos + `family_given_file_type`
  (top 6 familias × top 6 file_type, P(familia | file_type)).

### Bayes (sección 11)
`prior` (P(familia), top 8 + "Otras"), `evidence[]` aplicada en orden, y por
paso: `likelihood` P(e|familia), `marginal` P(e), `posterior`. Se avisa que el
encadenamiento supone independencia condicional (naive Bayes). `steps[]`
permite graficar prior → posterior. Si no hay evidencia, devolver solo prior y
un ejemplo por defecto (`file_type` más común).

### RandomVariables (sección 12)
- `X`: nº de muestras por hora — **discreta**. `pmf` [{k, empirical}],
  E[X] (`mean`), Var[X] (`variance`), `std`, `tail` [{k, p_equal, p_at_least}]
  con P(X=k) y P(X≥k).
- `Z`: nº de tags por muestra — **discreta**, misma forma que X.
- `Y`: tamaño de archivo en bytes — **continua**. `mean`, `variance`, `std`,
  `histogram` (bins log), `cdf` [{x, cdf_empirical}] (80 puntos en escala log)
  y `probabilities` [{label, p_empirical}] por intervalos (<100 KiB,
  100 KiB–1 MiB, >1 MiB, >10 MiB).
- Cada una con `id, name, description, kind: "discrete"|"continuous"`, `support`.

### Viz (sección 13)
- `family_hour_matrix`: familias top 8 × horas (conteos) para terreno 3D.
- `size_histogram`: bins log para barras 3D.
- `percentile_curve`: p1..p99 de file_size.
- `family_nodes`/`family_links`: red de co-ocurrencia de familias por
  `file_type` y `delivery_method`.
- `trend`: serie por hora + media móvil (3 h).

## Consumo en Next.js
- Cliente en `src/lib/api.ts` (`import "server-only"`), una función tipada por
  endpoint, `fetch` con `next: { revalidate: 300, tags: ["bazaar"] }`.
- Páginas = Server Components que hacen `await` de la API; las gráficas
  recharts/three son Client Components que reciben datos por props.
- Server Actions (`src/app/actions.ts`): `setWindow` (validar horas y
  `redirect`), `refreshData` (`revalidateTag("bazaar")` + `POST /api/snapshot`),
  `runBayes` (valida evidencia → resultado con `useActionState`),
  `runCombinatorics` (n,k → `CombCalc`), `searchSamples` (explorador).
