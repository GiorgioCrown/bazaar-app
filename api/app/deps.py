"""Dependencias comunes de los endpoints."""
from __future__ import annotations

from typing import Annotated

from fastapi import HTTPException, Query

from . import data

Hours = Annotated[int, Query(ge=1, le=168, description="Ventana en horas (1-168)")]


def get_dataset(hours: int) -> data.Dataset:
    try:
        return data.load(hours)
    except data.DataUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
