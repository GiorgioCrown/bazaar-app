"""/api/viz (sección 13): datos listos para gráficas 3D y 2D."""
from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter

from .deps import Hours, get_dataset
from .families import hourly_counts
from .models import Viz
from .util import clean

router = APIRouter(prefix="/api")


def _hour_label(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%d %H:00")


def family_network(enr: pd.DataFrame, top: int = 14) -> tuple[list[dict], list[dict]]:
    """Nodos = familias top; enlaces = similitud coseno del perfil de atributos.

    El perfil de una familia es el vector de conteos sobre las categorías
    file_type:* y delivery_method:*. weight = coseno en [0,1]; se conservan
    enlaces con coseno >= 0.3 (máx. 60).
    """
    fams = enr["family"].dropna().value_counts().head(top)
    sub = enr[enr["family"].isin(fams.index)]
    ft = pd.crosstab(sub["family"], "file_type:" + sub["file_type"].fillna("?"))
    dm = pd.crosstab(sub["family"], "delivery_method:" + sub["delivery_method"].fillna("?"))
    prof = pd.concat([ft, dm], axis=1).reindex(fams.index).fillna(0).to_numpy(dtype=float)
    norm = np.linalg.norm(prof, axis=1, keepdims=True)
    unit = prof / np.where(norm == 0, 1, norm)
    cos = unit @ unit.T
    names = list(fams.index)
    links = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            if cos[i, j] >= 0.3:
                links.append({"source": names[i], "target": names[j], "weight": round(float(cos[i, j]), 4)})
    links.sort(key=lambda link: -link["weight"])

    def top_type(s: pd.Series) -> str:
        m = s.dropna().mode()
        return str(m.iat[0]) if not m.empty else "?"

    group = sub.groupby("family")["file_type"].agg(top_type)
    nodes = [{"id": f, "count": int(c), "group": str(group.get(f, "?"))} for f, c in fams.items()]
    return nodes, links[:60]


@router.get("/viz", response_model=Viz)
def viz(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    enr = df[df["enriched"]]
    hc = hourly_counts(df)
    top = df["family"].dropna().value_counts().head(8).index.tolist()
    mat = (
        df[df["family"].isin(top)]
        .groupby(["family", "hour"])
        .size()
        .unstack(fill_value=0)
        .reindex(index=top, columns=hc.index, fill_value=0)
    )
    size = enr["file_size"].dropna().astype("float64").to_numpy()
    if size.size:
        lo, hi = size.min(), size.max()
        edges = np.logspace(np.log10(max(lo, 1)), np.log10(max(hi, 2)), 17)
        counts, edges = np.histogram(size, bins=edges)
        pcts = np.percentile(size, np.arange(1, 100), method="linear")
    else:
        edges, counts, pcts = np.array([1.0, 10.0]), np.array([0]), np.zeros(99)
    nodes, links = family_network(enr)
    ma = hc.rolling(3, min_periods=1).mean()
    return clean(
        {
            "families": top,
            "hours": [_hour_label(h) for h in hc.index],
            "family_hour_matrix": mat.to_numpy().tolist(),
            "size_histogram": {"edges": edges, "counts": counts},
            "percentile_curve": [{"p": p, "value": float(v)} for p, v in zip(range(1, 100), pcts)],
            "family_nodes": nodes,
            "family_links": links,
            "trend": [
                {"hour": _hour_label(h), "count": int(c), "moving_avg": float(m)}
                for (h, c), m in zip(hc.items(), ma)
            ],
        }
    )
