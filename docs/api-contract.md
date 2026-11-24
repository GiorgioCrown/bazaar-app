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
- Todo el cómputo estadístico es Python (pandas + numpy; scipy permitido para
  distribuciones/pruebas). Next.js solo presenta e interpreta.
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

## Endpoints (todos GET salvo indicación)
| Ruta | Sección | Contenido |
|---|---|---|
| `/api/health` | – | `{status, offline, rows_cached}` |
| `/api/overview?hours=` | base | `Overview` |
| `/api/families?hours=` | base (migra `src/lib/stats.ts`) | `Families` |
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
  vs. observados con conteos top), y un cálculo hipergeométrico:
  P(al menos 1 de la familia líder en una selección de 10 muestras).
- Cada bloque trae `formula`, `inputs`, `result` (string) y `log10`.

### Descriptive (sección 6)
Para cada variable (`file_size` continua, `hourly_count` discreta,
`family_count` discreta, `n_tags` discreta): `n, mean, median, mode(s),
std (muestral, ddof=1), variance, min, max, range, cv, skewness, kurtosis`,
`histogram` {edges, counts, density, scale:"linear"|"log"} (file_size en
escala log10), y `outliers_iqr` (conteo + cercas).

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
- `axioms`: `checks[]` {name, passed, detail}: 0≤P≤1 para todo evento,
  P(Ω)=1, suma de la partición por familias (incl. "Sin clasificar") = 1,
  aditividad para eventos disjuntos, complemento, inclusión-exclusión.
- `independence`: todos los pares (i<j): `p_a, p_b, p_ab, p_a_times_p_b,
  abs_diff, lift, chi2, p_value, independent (p_value>=0.05)`.
- `conditional`: matriz `P(row | col)` para los eventos + `family_given_file_type`
  (top 6 familias × top 6 file_type, P(familia | file_type)).

### Bayes (sección 11)
`prior` (P(familia), top 8 + "Otras"), `evidence[]` aplicada en orden, y por
paso: `likelihood` P(e|familia), `marginal` P(e), `posterior`. Se avisa que el
encadenamiento supone independencia condicional (naive Bayes). `steps[]`
permite graficar prior → posterior. Si no hay evidencia, devolver solo prior y
un ejemplo por defecto (`file_type` más común).

### RandomVariables (sección 12)
- `X`: nº de muestras por hora — **discreta**. pmf empírica vs. Poisson(λ),
  E[X], Var[X], índice de dispersión, χ² de bondad de ajuste (agrupando colas),
  P(X=k), P(X≥k), alternativa Binomial Negativa (método de momentos) si hay
  sobredispersión.
- `Y`: tamaño de archivo en bytes — **continua**. Ajuste lognormal
  (μ,σ de ln Y), pdf teórica vs. histograma, CDF empírica vs. teórica, KS.
- `Z`: nº de tags por muestra — **discreta**, pmf empírica, E[Z], Var[Z].
- Cada una con `kind: "discrete"|"continuous"`, `support`, `description`.

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
