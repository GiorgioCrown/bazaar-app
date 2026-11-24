"""/api/positions (sección 7): cuartiles, deciles, percentiles y boxplot.

Cuantiles con interpolación lineal (numpy.percentile, method="linear"; equivale
a Excel PERCENTIL.INC y al tipo 7 de R): posición h = (n-1)·p, valor =
x[floor(h)] + (h - floor(h))·(x[floor(h)+1] - x[floor(h)]).
El rango percentil usa scipy.stats.percentileofscore(kind="weak"): % de datos <= valor.
"""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter
from scipy import stats

from .deps import Hours, get_dataset
from .models import Positions
from .util import clean
from .variables import Var, build_vars

router = APIRouter(prefix="/api")

KIB, MIB = 1024, 1024 * 1024


def rank_examples(v: Var) -> list[tuple[str, float]]:
    x = v.values
    mean = float(x.mean())
    if v.key == "file_size":
        return [
            ("Tamaño mediano de la muestra", float(np.median(x))),
            ("100 KiB", 100 * KIB),
            ("1 MiB", MIB),
            ("10 MiB", 10 * MIB),
        ]
    if v.key == "hourly_count":
        return [
            ("Media por hora", mean),
            ("Dos veces la media", 2 * mean),
            ("Hora más activa", float(x.max())),
        ]
    if v.key == "family_count":
        return [
            ("Familia mediana", float(np.median(x))),
            ("10 muestras", 10.0),
            ("Familia líder", float(x.max())),
        ]
    return [("Sin tags (0)", 0.0), ("2 tags", 2.0), ("5 tags", 5.0)]


def position(v: Var) -> dict:
    x = v.values
    if x.size == 0:
        return {}

    def q(p: float) -> float:
        return float(np.percentile(x, p, method="linear"))

    q1, q2, q3 = q(25), q(50), q(75)
    iqr = q3 - q1
    inside = x[(x >= q1 - 1.5 * iqr) & (x <= q3 + 1.5 * iqr)]
    pcts = np.percentile(x, np.arange(1, 100), method="linear")
    return {
        "key": v.key,
        "label": v.label,
        "unit": v.unit,
        "quartiles": {"q1": q1, "q2": q2, "q3": q3, "iqr": iqr},
        "deciles": {f"d{i}": q(10 * i) for i in range(1, 10)},
        "percentiles": [{"p": p, "value": float(val)} for p, val in zip(range(1, 100), pcts)],
        "highlights": {"p90": q(90), "p95": q(95), "p99": q(99)},
        "boxplot": {
            "min": float(x.min()),
            "q1": q1,
            "median": q2,
            "q3": q3,
            "max": float(x.max()),
            "whisker_low": float(inside.min()) if inside.size else q1,
            "whisker_high": float(inside.max()) if inside.size else q3,
        },
        "rank_examples": [
            {"label": lab, "value": val, "percentile_rank": float(stats.percentileofscore(x, val, kind="weak"))}
            for lab, val in rank_examples(v)
        ],
    }


@router.get("/positions", response_model=Positions)
def positions(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    return clean({"variables": [p for p in (position(v) for v in build_vars(df)) if p]})
