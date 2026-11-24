# API FastAPI: análisis probabilístico de malware

Calcula en Python (pandas + numpy + scipy) todos los temas del curso sobre datos
**reales** de MalwareBazaar (abuse.ch). Next.js solo presenta. Contrato en
`docs/api-contract.md`; tipos TS en `src/lib/api-types.ts`.

## Arranque
```bash
npm run api        # uvicorn en http://127.0.0.1:8000 (con --reload)
npm run api:test   # pytest
```
Venv: `api/.venv` (dependencias en `api/requirements.txt`). La key
`ABUSECH_AUTH_KEY` se lee de `.env.local` (raíz) o del entorno; nunca se imprime.
Documentación interactiva: `http://127.0.0.1:8000/docs`.

## Datos
1. `recent_detections&hours=N` → `sha256`, `first_seen`, `file_name`, `signature`.
2. Enriquecimiento real con `get_siginfo` (familias con ≥ 5 muestras),
   `get_file_type` (20 tipos) y `get_recent`, unido por `sha256`
   → `file_size`, `file_type`, `tags`, `delivery_method`, ClamAV…
   Cobertura típica 90-99 %; las filas sin metadatos quedan con `NA`
   (`enriched=False`). Límite: `get_siginfo` devuelve ≤ 1000 muestras por familia.
3. Caché en memoria 5 min por `hours` (enriquecimiento 30 min). La primera carga
   tarda ~1 min (≈ 90 consultas con reintentos); las siguientes son inmediatas.
4. **Offline**: `BAZAAR_OFFLINE=1`, o sin key + snapshot, o fallo de red con
   snapshot disponible → se usa `api/data/snapshot.json` (copia real).
   `POST /api/snapshot` lo regenera.

DataFrame base (`app/data.py: load_df`): `sha256, first_seen, family, file_type,
file_size, delivery_method, reporter, tags, n_tags, clamav, hour, enriched, file_name`.

## Endpoints
`/api/health`, `/api/overview`, `/api/families`, `/api/search`, `/api/combinatorics`,
`/api/combinatorics/calc?n=&k=`, `/api/descriptive`, `/api/positions`,
`/api/probability`, `/api/bayes?evidence=campo:valor` (repetible),
`/api/random-variables`, `/api/viz`, `POST /api/snapshot`.
Todos aceptan `?hours=1..168` (default 168), excepto `search` y `calc`.

## Decisiones estadísticas (verificables)
- **Desviación y varianza muestrales**: `ddof=1`. Asimetría y curtosis (exceso)
  con corrección de sesgo (`scipy.stats.skew/kurtosis(bias=False)`).
- **Cuantiles**: `numpy.percentile(method="linear")` (h = (n−1)p; igual que
  `PERCENTIL.INC` de Excel y tipo 7 de R). Deciles D1–D9 = P10…P90.
- **Moda**: todas las modas; lista vacía si ningún valor se repite.
- **Atípicos / bigotes**: regla de Tukey, cercas Q1−1.5·IQR y Q3+1.5·IQR.
- **Intervalo de proporciones**: Wilson 95 %. Dispersión de Poisson:
  χ² = Σ(x−x̄)²/x̄ con n−1 gl.
- **Probabilidad (8-10)**: Ω = muestras con metadatos completos; P(E)=|E|/|Ω|.
  Independencia: χ² de Pearson 2×2 sin corrección de Yates, α = 0.05 (con n
  grande casi todo se rechaza: se interpreta junto con `lift` y `abs_diff`).
  Si P(F)=0 el χ² no está definido → `null`.
- **Bayes**: P(h|e)=P(e|h)P(h)/Σ_h P(e|h)P(h), sin suavizado; evidencias
  encadenadas = naive Bayes (independencia condicional). Evidencia imposible → 422.
- **X** (muestras/hora): Poisson(λ=x̄) vs. Binomial Negativa por momentos
  (r=m²/(v−m), p=m/v); χ² con clases agrupadas (E ≥ 5) y gl = clases−1−parámetros.
- **Y** (tamaño): lognormal con μ,σ de ln Y (σ muestral); KS (p-valor optimista
  porque los parámetros se estiman de los mismos datos).
- **Enteros enormes** (factoriales, C(n,k)): enteros de Python → `string` + `log10`.
- **Viz**: enlaces de la red de familias = similitud coseno entre perfiles de
  `file_type` y `delivery_method` (≥ 0.3, máx. 60).
- JSON sin `NaN`/`Inf` (→ `null`). Errores: `{"detail": "…"}` en español.

## Pruebas
`api/tests/` usa un DataFrame **sintético solo para validar fórmulas** con
resultados calculables a mano (cuartiles de 1..9, Bayes P(X|exe)=0.75, C(n,k),
Poisson suma 1…). La API real nunca usa datos inventados.
