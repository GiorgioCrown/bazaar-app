"""Las cuatro variables numéricas de las secciones 6 y 7, extraídas del DataFrame."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .families import hourly_counts


@dataclass(frozen=True)
class Var:
    key: str
    label: str
    unit: str
    kind: str  # "discrete" | "continuous"
    values: np.ndarray  # float64, sin NA
    scale: str  # escala del histograma: "linear" | "log"


def build_vars(df: pd.DataFrame) -> list[Var]:
    enr = df[df["enriched"]]
    size = enr["file_size"].dropna().astype("float64").to_numpy()
    hourly = hourly_counts(df).to_numpy(dtype="float64")
    fam = df["family"].dropna().value_counts().to_numpy(dtype="float64")
    ntags = enr["n_tags"].dropna().astype("float64").to_numpy()
    return [
        Var("file_size", "Tamaño de archivo", "bytes", "continuous", size, "log"),
        Var("hourly_count", "Muestras por hora", "muestras/hora", "discrete", hourly, "linear"),
        Var("family_count", "Muestras por familia", "muestras/familia", "discrete", fam, "log"),
        Var("n_tags", "Tags por muestra", "tags", "discrete", ntags, "linear"),
    ]
