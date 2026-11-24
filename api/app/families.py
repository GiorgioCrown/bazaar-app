"""/api/families: conteo y proporción por familia, serie por hora y tipos de archivo."""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter

from .deps import Hours, get_dataset
from .models import Families
from .util import clean, fmt_utc

router = APIRouter(prefix="/api")


def hourly_counts(df: pd.DataFrame) -> pd.Series:
    """Conteo por hora UTC incluyendo horas vacías (rango completo)."""
    t = df["hour"].dropna()
    if t.empty:
        return pd.Series(dtype="int64")
    full = pd.date_range(t.min(), t.max(), freq="h")
    return t.value_counts().reindex(full, fill_value=0).sort_index()


@router.get("/families", response_model=Families)
def families(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    total = len(df)
    cls = df[df["family"].notna()]
    classified = len(cls)

    out = []
    g = cls.groupby("family")["first_seen"].agg(["count", "min", "max"]).reset_index()
    g = g.sort_values(["count", "family"], ascending=[False, True])
    for row in g.itertuples(index=False):
        out.append(
            {
                "family": row.family,
                "count": int(row.count),
                "p": row.count / classified,
                "first_seen": fmt_utc(row.min),
                "last_seen": fmt_utc(row.max),
            }
        )

    top5 = float(sum(f["p"] for f in out[:5]))
    hc = hourly_counts(df)
    hourly = [{"hour": fmt_utc(h), "count": int(c)} for h, c in hc.items()]

    ft = df["file_type"].fillna("desconocido").value_counts()
    file_types = [{"type": t, "count": int(c), "p": c / total if total else 0.0} for t, c in ft.items()]

    return clean({"families": out, "top5_share": top5, "hourly": hourly, "file_types": file_types})
