# Bazaar Board · Análisis probabilístico de malware

Proyecto de Probabilidad y Estadística. Descarga registros reales de
[MalwareBazaar](https://bazaar.abuse.ch/) (abuse.ch) y los analiza con
combinatoria, estadística descriptiva, probabilidad, Bayes y variables
aleatorias.

## Arquitectura

```
navegador ──► Next.js 16 (RSC + server actions, :3000) ──► FastAPI (pandas/scipy, :8000) ──► abuse.ch
```

- **`api/`**: API FastAPI en Python. Todo el cómputo estadístico vive aquí y es
  la única parte que habla con abuse.ch (la clave `ABUSECH_AUTH_KEY` nunca llega
  al navegador ni a Next.js). Contrato: [`docs/api-contract.md`](docs/api-contract.md).
- **`src/`**: Next.js (App Router, React 19, Tailwind 4, shadcn/ui, recharts).
  Las páginas son Server Components que hacen `await` a la API con el cliente
  tipado `src/lib/api.ts` (`server-only`, caché de 5 min con la etiqueta
  `bazaar`). Los Client Components solo existen donde hay interactividad
  (gráficas, tablas ordenables, calculadora, laboratorio de Bayes) y reciben
  los datos por props.
- **Server actions** (`src/app/actions.ts`): `setWindow`, `refreshData`,
  `runBayes`, `runCombinatorics` y `searchSamples`. Toda entrada se valida en el
  servidor y los formularios funcionan sin JavaScript.

## Cómo correrlo

Requisitos: Node 20+ y Python 3.12.

```bash
# 1. dependencias
npm install
python -m venv api/.venv
api/.venv/Scripts/python -m pip install -r api/requirements.txt   # Windows
# (Linux/macOS: api/.venv/bin/python -m pip install -r api/requirements.txt)

# 2. clave de abuse.ch en .env.local (raíz del proyecto)
echo ABUSECH_AUTH_KEY=tu_clave > .env.local

# 3. dos terminales
npm run api    # FastAPI en http://127.0.0.1:8000
npm run dev    # Next.js en http://localhost:3000
```

Variables de entorno: `API_URL` (Next → FastAPI, por defecto
`http://127.0.0.1:8000`), `ABUSECH_AUTH_KEY` (solo la lee Python) y
`BAZAAR_OFFLINE=1` para trabajar sin red con `api/data/snapshot.json`
(una copia de una respuesta real; “Actualizar datos → guardar copia offline”
la renueva). Pruebas de la API: `npm run api:test`.

## Temas cubiertos

| Tema | Ruta | Contenido |
|---|---|---|
| Resumen, multinomial y Poisson | `/analisis` | Distribución por familia con IC de Wilson, llegadas por hora, prueba de dispersión, CSV en `/analisis/csv` |
| 5 · Análisis combinatorio | `/combinatoria` | Principio de conteo (perfiles familia × tipo × entrega), permutaciones (rankings), combinaciones (pares de tags, hipergeométrica) y calculadora n, k |
| 6 · Estadística descriptiva | `/estadistica#descriptiva` | Media, mediana, moda, desviación estándar, histogramas e interpretación |
| 7 · Medidas de posición | `/estadistica#posicion` | Q1–Q3, D1–D9, P90/P95/P99, boxplot, curva de percentiles |
| 8 · Axiomas de probabilidad | `/probabilidad#axiomas` | Eventos A–F, verificaciones ✔/✘, suma de la partición = 1 |
| 9 · Independencia | `/probabilidad#independencia` | P(A∩B) frente a P(A)P(B), lift, χ² y veredicto por par |
| 10 · Probabilidad condicional | `/probabilidad#condicional` | Matriz P(A\|B) y P(familia \| tipo de archivo) |
| 11 · Teorema de Bayes | `/bayes` | Laboratorio: eliges evidencias y ves prior → posterior paso a paso |
| 12 · Variables aleatorias | `/variables` | X (Poisson/binomial negativa), Y (lognormal), Z; E y Var |
| 13 · Visualización 3D | `/visualizacion` | Terreno familia × hora, histograma 3D, red de co-ocurrencia |
| Explorador | `/explorador` | Búsqueda de muestras por hash, familia, tag, tipo o ClamAV |

Cada sección incluye una interpretación en lenguaje claro y un bloque
“Cómo se relaciona con el problema”.
