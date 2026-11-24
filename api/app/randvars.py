"""/api/random-variables (sección 12): variables aleatorias discretas y continua.

X = muestras por hora (discreta)
Y = tamaño de archivo en bytes (continua)
Z = tags por muestra (discreta)
Todo sale de las frecuencias observadas: E[V] = promedio, Var[V] = varianza muestral.
"""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException

from .deps import Hours, get_dataset
from .descriptive import histogram
from .models import RandomVariables
from .util import clean
from .variables import build_vars

router = APIRouter(prefix="/api")

KIB, MIB = 1024, 1024 * 1024


def moments(v: np.ndarray) -> tuple[float, float, float]:
    var = float(v.var(ddof=1))
    return float(v.mean()), var, float(np.sqrt(var))


def variable_x(x: np.ndarray) -> dict:
    n = len(x)
    mean, var, std = moments(x)
    freq = np.bincount(x.astype(int))
    emp = freq / n
    cand = sorted({0, int(round(mean / 2)), int(round(mean)), int(round(1.5 * mean)), int(round(2 * mean)), int(round(3 * mean)), int(x.max())})
    tail = [
        {"k": k, "p_equal": float(np.mean(x == k)), "p_at_least": float(np.mean(x >= k))}
        for k in cand
        if k <= x.max()
    ]
    desc = (
        f"Cuántas muestras llegan en cada hora (n = {n} horas). Es DISCRETA: toma valores 0, 1, 2, … "
        f"En promedio llegan E[X] = {mean:.1f} muestras por hora, con desviación estándar {std:.1f} (Var[X] = {var:.1f}). "
        "La primera y la última hora pueden estar incompletas."
    )
    return {
        "id": "X",
        "name": "X: muestras por hora",
        "description": desc,
        "kind": "discrete",
        "support": "{0, 1, 2, …} (enteros no negativos)",
        "mean": mean,
        "variance": var,
        "std": std,
        "pmf": [{"k": int(k), "empirical": float(emp[k])} for k in range(len(freq))],
        "tail": tail,
    }


def variable_y(y: np.ndarray) -> dict:
    y = y[y > 0]  # escala log: el tamaño 0 no se puede graficar
    n = len(y)
    mean, var, std = moments(y)
    xs = np.logspace(np.log10(y.min()), np.log10(y.max()), 80)
    xs[0], xs[-1] = y.min(), y.max()  # evita error de redondeo en los extremos
    ys = np.sort(y)
    ecdf = np.searchsorted(ys, xs, side="right") / n
    probs = [
        ("P(Y < 100 KiB)", float(np.mean(y < 100 * KIB))),
        ("P(100 KiB ≤ Y ≤ 1 MiB)", float(np.mean((y >= 100 * KIB) & (y <= MIB)))),
        ("P(Y > 1 MiB)", float(np.mean(y > MIB))),
        ("P(Y > 10 MiB)", float(np.mean(y > 10 * MIB))),
    ]
    desc = (
        f"Tamaño en bytes de cada muestra (n = {n}). Es CONTINUA: puede tomar cualquier valor positivo. "
        f"El tamaño promedio es E[Y] = {mean:,.0f} bytes y la desviación estándar {std:,.0f}. "
        f"De cada 100 muestras, {100 * probs[0][1]:.0f} pesan menos de 100 KiB y {100 * probs[2][1]:.0f} pesan más de 1 MiB. "
        "Se usa escala logarítmica porque hay archivos muy pequeños y muy grandes."
    )
    return {
        "id": "Y",
        "name": "Y: tamaño de archivo (bytes)",
        "description": desc,
        "kind": "continuous",
        "support": "(0, ∞) bytes",
        "mean": mean,
        "variance": var,
        "std": std,
        "histogram": histogram(y, "log", False),
        "cdf": [{"x": float(x), "cdf_empirical": float(e)} for x, e in zip(xs, ecdf)],
        "probabilities": [{"label": lab, "p_empirical": p} for lab, p in probs],
    }


def variable_z(z: np.ndarray) -> dict:
    n = len(z)
    mean, var, std = moments(z)
    freq = np.bincount(z.astype(int))
    cand = sorted({0, 1, 2, int(z.max())})
    tail = [
        {"k": k, "p_equal": float(np.mean(z == k)), "p_at_least": float(np.mean(z >= k))}
        for k in cand
        if k <= z.max()
    ]
    return {
        "id": "Z",
        "name": "Z: tags por muestra",
        "description": (
            f"Cuántas etiquetas (tags) tiene cada muestra (n = {n}). Es DISCRETA: toma valores 0, 1, …, {int(z.max())}. "
            f"En promedio E[Z] = {mean:.2f} tags por muestra, con desviación estándar {std:.2f} (Var[Z] = {var:.2f})."
        ),
        "kind": "discrete",
        "support": f"{{0, 1, 2, …}} (observado 0 a {int(z.max())})",
        "mean": mean,
        "variance": var,
        "std": std,
        "pmf": [{"k": int(k), "empirical": float(c / n)} for k, c in enumerate(freq)],
        "tail": tail,
    }


@router.get("/random-variables", response_model=RandomVariables)
def random_variables(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    v = {x.key: x.values for x in build_vars(df)}
    if len(v["hourly_count"]) < 3 or len(v["file_size"]) < 3 or len(v["n_tags"]) < 3:
        raise HTTPException(status_code=422, detail="Muestra insuficiente en la ventana para calcular las variables aleatorias.")
    return clean({"X": variable_x(v["hourly_count"]), "Y": variable_y(v["file_size"]), "Z": variable_z(v["n_tags"])})
