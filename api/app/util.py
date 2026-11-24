"""Utilidades comunes: limpieza de JSON (NaN/Inf -> null) y formatos."""
from __future__ import annotations

import math
from datetime import datetime
from typing import Any

import sys

import numpy as np
import pandas as pd

if hasattr(sys, "set_int_max_str_digits"):
    sys.set_int_max_str_digits(0)  # factoriales enormes -> str


def clean(obj: Any) -> Any:
    """Convierte recursivamente a tipos JSON puros; NaN/Inf/NA -> None."""
    if obj is None or obj is pd.NA or obj is pd.NaT:
        return None
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        f = float(obj)
        return f if math.isfinite(f) else None
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.strftime("%Y-%m-%d %H:%M")
    if isinstance(obj, dict):
        return {str(k): clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, np.ndarray, pd.Series)):
        return [clean(v) for v in obj]
    return obj


def fmt_utc(ts: pd.Timestamp | None) -> str | None:
    """'YYYY-MM-DD HH:MM' en UTC (formato del contrato)."""
    if ts is None or pd.isna(ts):
        return None
    return ts.strftime("%Y-%m-%d %H:%M")


def big_str(n: int) -> str:
    """Entero Python arbitrario -> string decimal (sin limite de digitos)."""
    import sys

    if hasattr(sys, "set_int_max_str_digits"):
        sys.set_int_max_str_digits(0)
    return str(n)


def log10_int(n: int) -> float:
    """log10 de un entero positivo arbitrariamente grande."""
    if n <= 0:
        return 0.0
    return math.log10(n) if n < 10**300 else (len(str(n)) - 1) + math.log10(
        int(str(n)[:15]) / 10**14
    )


def observed_hours(df: pd.DataFrame) -> float:
    """Ventana real observada (la API puede truncar); mínimo 1 h."""
    t = df["first_seen"].dropna()
    if t.empty:
        return 1.0
    return max((t.max() - t.min()).total_seconds() / 3600, 1.0)
