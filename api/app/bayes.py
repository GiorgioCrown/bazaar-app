"""/api/bayes (sección 11): prior -> evidencia -> posterior, con evidencias encadenables.

Hipótesis H = familia (top 8 + "Otras"). Para cada evidencia e:
    P(e|h) = |h ∩ e| / |h|          (verosimilitud, frecuencias relativas)
    P(e)   = Σ_h P(e|h) · P(h)      (marginal bajo el modelo actual)
    P(h|e) = P(e|h) · P(h) / P(e)   (posterior = prior del siguiente paso)
El encadenamiento multiplica verosimilitudes: supone independencia condicional
de las evidencias dado h (naive Bayes). No se aplica suavizado.
"""
from __future__ import annotations

from typing import Annotated

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from .deps import Hours, get_dataset
from .models import Bayes
from .probability import omega
from .util import clean

router = APIRouter(prefix="/api")

KIB, MIB = 1024, 1024 * 1024
OTHERS = "Otras"
FIELDS = ["file_type", "delivery_method", "clamav", "size_band", "tag"]
BANDS = {"small": "< 100 KiB", "medium": "100 KiB – 1 MiB", "large": "> 1 MiB"}


def evidence_mask(om: pd.DataFrame, field: str, value: str) -> np.ndarray:
    if field == "file_type":
        return (om["file_type"] == value).to_numpy()
    if field == "delivery_method":
        return (om["delivery_method"] == value).to_numpy()
    if field == "clamav":
        return (om["clamav"].fillna(False) == (value == "true")).to_numpy()
    if field == "size_band":
        s = om["file_size"].astype("float64")
        band = np.where(s < 100 * KIB, "small", np.where(s <= MIB, "medium", "large"))
        return band == value
    return om["tags"].map(lambda t: value in t).to_numpy(dtype=bool)  # tag (coincidencia exacta)


def parse_evidence(raw: list[str]) -> list[tuple[str, str]]:
    out = []
    for item in raw:
        if ":" not in item:
            raise HTTPException(status_code=422, detail=f"Evidencia inválida '{item}': use campo:valor (p. ej. file_type:exe).")
        f, v = item.split(":", 1)
        f, v = f.strip(), v.strip()
        if f not in FIELDS:
            raise HTTPException(status_code=422, detail=f"Campo de evidencia desconocido '{f}'. Opciones: {', '.join(FIELDS)}.")
        if f == "clamav" and v not in ("true", "false"):
            raise HTTPException(status_code=422, detail="Para clamav el valor debe ser 'true' o 'false'.")
        if f == "size_band" and v not in BANDS:
            raise HTTPException(status_code=422, detail="Para size_band el valor debe ser small, medium o large.")
        out.append((f, v))
    return out


@router.get("/bayes", response_model=Bayes)
def bayes(
    hours: Hours = 168,
    evidence: Annotated[list[str] | None, Query(description="campo:valor, repetible")] = None,
) -> dict:
    ev = parse_evidence(evidence or [])
    om = omega(get_dataset(hours).df)
    n = len(om)
    if n == 0:
        raise HTTPException(status_code=422, detail="No hay muestras con metadatos completos en la ventana.")

    top = om["family"].value_counts().head(8).index.tolist()
    hyp_of = om["family"].where(om["family"].isin(top), OTHERS).fillna(OTHERS)
    hyps = top + ([OTHERS] if (hyp_of == OTHERS).any() else [])
    h_counts = np.array([(hyp_of == h).sum() for h in hyps], dtype=float)
    prior0 = h_counts / n

    current = prior0.copy()
    steps = []
    for field, value in ev:
        m = evidence_mask(om, field, value)
        like = np.array([(m & (hyp_of == h).to_numpy()).sum() / c for h, c in zip(hyps, h_counts)])
        joint = like * current
        marginal = float(joint.sum())
        if marginal <= 0:
            raise HTTPException(
                status_code=422,
                detail=f"La evidencia {field}={value} no aparece en ninguna muestra de las hipótesis restantes (P(e)=0): no se puede calcular el posterior.",
            )
        post = joint / marginal
        steps.append(
            {
                "evidence": {"field": field, "value": value},
                "marginal": marginal,
                "rows": [
                    {"hypothesis": h, "prior": float(current[i]), "likelihood": float(like[i]), "joint": float(joint[i]), "posterior": float(post[i])}
                    for i, h in enumerate(hyps)
                ],
            }
        )
        current = post

    ft_top = om["file_type"].value_counts()
    tag_counts = om["tags"].explode().dropna().value_counts()
    note = (
        f"Espacio muestral: {n} muestras con metadatos completos de la ventana. Hipótesis: las 8 familias más frecuentes y «{OTHERS}». "
        "Verosimilitudes = frecuencias relativas P(e|familia) sin suavizado. Al encadenar evidencias se supone independencia "
        "condicional dado la familia (naive Bayes), supuesto que rara vez se cumple del todo (p. ej. tipo de archivo y tamaño están relacionados)."
    )
    if not ev and len(ft_top):
        t = ft_top.index[0]
        note += f" Ejemplo: pruebe evidence=file_type:{t} (el tipo más común, P={ft_top.iloc[0] / n:.3f})."
    prior = [{"hypothesis": h, "p": float(p)} for h, p in zip(hyps, prior0)]
    return clean(
        {
            "hypotheses": hyps,
            "prior": prior,
            "steps": steps,
            "posterior": [{"hypothesis": h, "p": float(p)} for h, p in zip(hyps, current)],
            "note": note,
            "options": {
                "file_type": ft_top.head(15).index.tolist(),
                "delivery_method": om["delivery_method"].value_counts().index.tolist(),
                "clamav": ["true", "false"],
                "size_band": list(BANDS),
                "tag": tag_counts.head(30).index.tolist(),
            },
        }
    )
