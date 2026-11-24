"""Modelos Pydantic de respuesta (espejo de src/lib/api-types.ts)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

BigIntStr = str


class Health(BaseModel):
    status: Literal["ok"]
    offline: bool
    rows_cached: int


class Overview(BaseModel):
    total: int
    classified: int
    unclassified: int
    window_hours_requested: int
    window_hours_observed: float
    window_start: str | None
    window_end: str | None
    distinct_families: int
    lambda_total: float
    offline: bool
    fetched_at: str
    # Extra (documentado en el contrato): muestras con metadatos completos.
    enriched: int
    enriched_fraction: float
