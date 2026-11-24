"""/api/families: multinomial por familia + Wilson + Poisson + dispersión + entropía.

Migración de src/lib/stats.ts (misma lógica, ahora sobre un DataFrame).
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from fastapi import APIRouter
from scipy import stats

from .deps import Hours, get_dataset
from .models import Families
from .util import clean, fmt_utc, observed_hours

router = APIRouter(prefix="/api")


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Intervalo de Wilson al 95 % para una proporción binomial."""
    if n == 0:
        return 0.0, 0.0
    p = k / n
    z2 = z * z
    denom = 1 + z2 / n
    center = (p + z2 / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denom
    return max(0.0, center - half), min(1.0, center + half)


def hourly_counts(df: pd.DataFrame) -> pd.Series:
    """Conteo por hora UTC incluyendo horas vacías (rango completo)."""
    t = df["hour"].dropna()
    if t.empty:
        return pd.Series(dtype="int64")
    full = pd.date_range(t.min(), t.max(), freq="h")
    return t.value_counts().reindex(full, fill_value=0).sort_index()


def dispersion_test(hc: pd.Series) -> dict | None:
    """Índice de dispersión Var/Media y chi² de Poisson (¿llegadas ~ Poisson?)."""
    k = len(hc)
    if k <= 2:
        return None
    mean = float(hc.mean())
    if mean <= 0:
        return None
    var_sum = float(((hc - mean) ** 2).sum())
    chi2 = var_sum / mean
    return {
        "index": var_sum / (k - 1) / mean,
        "chi2": chi2,
        "df": k - 1,
        "p_value": float(stats.chi2.sf(chi2, k - 1)),
    }


@router.get("/families", response_model=Families)
def families(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    total = len(df)
    win = observed_hours(df)
    cls = df[df["family"].notna()]
    classified = len(cls)

    out = []
    g = cls.groupby("family")["first_seen"].agg(["count", "min", "max"]).reset_index()
    g = g.sort_values(["count", "family"], ascending=[False, True])
    for row in g.itertuples(index=False):
        lo, hi = wilson(int(row.count), classified)
        rate = row.count / win
        out.append(
            {
                "family": row.family,
                "count": int(row.count),
                "p": row.count / classified,
                "ci_low": lo,
                "ci_high": hi,
                "rate_per_hour": rate,
                "p_next_hour": 1 - math.exp(-rate),
                "p_next_24h": 1 - math.exp(-rate * 24),
                "first_seen": fmt_utc(row.min),
                "last_seen": fmt_utc(row.max),
            }
        )

    p = np.array([f["p"] for f in out])
    entropy = float(-(p * np.log2(p)).sum()) if len(p) else 0.0
    entropy_norm = entropy / math.log2(len(p)) if len(p) > 1 else 0.0
    gini = float(1 - (p**2).sum()) if len(p) else 0.0
    top5 = float(p[:5].sum()) if len(p) else 0.0

    hc = hourly_counts(df)
    hourly = [{"hour": fmt_utc(h), "count": int(c)} for h, c in hc.items()]

    ft = df["file_type"].fillna("desconocido").value_counts()
    file_types = [{"type": t, "count": int(c), "p": c / total if total else 0.0} for t, c in ft.items()]

    return clean(
        {
            "families": out,
            "entropy": entropy,
            "entropy_norm": entropy_norm,
            "gini_simpson": gini,
            "top5_share": top5,
            "hourly": hourly,
            "dispersion": dispersion_test(hc),
            "file_types": file_types,
        }
    )
