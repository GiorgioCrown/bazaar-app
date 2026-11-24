"""/api/descriptive (sección 6): estadística descriptiva con numpy.

- Desviación estándar y varianza muestrales (ddof=1).
- Moda: todas las modas; vacía si ningún valor se repite (frecuencia máxima 1).
- Atípicos: regla de Tukey, fuera de [Q1-1.5·IQR, Q3+1.5·IQR].
"""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from .deps import Hours, get_dataset
from .models import Descriptive
from .util import clean
from .variables import Var, build_vars

router = APIRouter(prefix="/api")


def histogram(values: np.ndarray, scale: str, discrete: bool) -> dict:
    """Histograma. 'log' usa clases equiespaciadas en log10 (bordes en unidades originales).

    density = conteo / (n · ancho de clase): integra 1 sobre el eje original.
    """
    if values.size == 0:
        return {"edges": [0.0, 1.0], "counts": [0], "density": [0.0], "scale": scale}
    lo, hi = float(values.min()), float(values.max())
    use_log = scale == "log" and lo > 0 and hi > lo
    if use_log:
        nb = int(min(20, max(5, np.ceil(1 + np.log2(values.size)))))
        edges = np.logspace(np.log10(lo), np.log10(hi), nb + 1)
        edges[0], edges[-1] = lo, hi
    elif discrete and hi - lo <= 40:
        edges = np.arange(np.floor(lo) - 0.5, np.ceil(hi) + 1.5, 1.0)
    elif hi > lo:
        edges = np.histogram_bin_edges(values, bins="fd")
        if len(edges) > 31:
            edges = np.linspace(lo, hi, 31)
    else:
        edges = np.array([lo - 0.5, hi + 0.5])
    counts, edges = np.histogram(values, bins=edges)
    density = counts / (values.size * np.diff(edges))
    return {"edges": edges, "counts": counts, "density": density, "scale": "log" if use_log else "linear"}


def describe(v: Var) -> dict:
    x = v.values
    n = int(x.size)
    if n == 0:
        return {}
    q1, q3 = np.percentile(x, [25, 75])
    iqr = q3 - q1
    fl, fh = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    vals, cnts = np.unique(x, return_counts=True)
    top = int(cnts.max())
    modes = [] if (top == 1 and n > 1) else [float(m) for m in vals[cnts == top]][:20]
    std = float(np.std(x, ddof=1)) if n > 1 else 0.0
    mean = float(np.mean(x))
    return {
        "key": v.key,
        "label": v.label,
        "unit": v.unit,
        "kind": v.kind,
        "n": n,
        "mean": mean,
        "median": float(np.median(x)),
        "modes": modes,
        "mode_count": top,
        "std": std,
        "variance": float(np.var(x, ddof=1)) if n > 1 else 0.0,
        "min": float(x.min()),
        "max": float(x.max()),
        "range": float(x.max() - x.min()),
        "histogram": histogram(x, v.scale, v.kind == "discrete"),
        "outliers": {"count": int(((x < fl) | (x > fh)).sum()), "fence_low": float(fl), "fence_high": float(fh)},
    }


@router.get("/descriptive", response_model=Descriptive)
def descriptive(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    return clean({"variables": [d for d in (describe(v) for v in build_vars(df)) if d]})
