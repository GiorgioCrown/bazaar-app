"""/api/search: proxy tipado de las 6 modalidades del explorador de abuse.ch."""
from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query

from . import data
from .models import SearchResponse

router = APIRouter(prefix="/api")

# modo de la UI -> (query de MalwareBazaar, parámetro del valor)
MODES = {
    "recent": ("recent_detections", "hours"),
    "hash": ("get_info", "hash"),
    "tag": ("get_taginfo", "tag"),
    "signature": ("get_siginfo", "signature"),
    "file_type": ("get_file_type", "file_type"),
    "clamav": ("get_clamavinfo", "clamav"),
}


def _offline(mode: str, value: str, limit: int) -> dict:
    rows = data.search_snapshot(mode, value, limit)
    return {"query_status": "ok" if rows else "no_results", "data": rows}


@router.get("/search", response_model=SearchResponse, response_model_exclude_none=True)
def search(
    mode: Literal["recent", "hash", "tag", "signature", "file_type", "clamav"],
    value: Annotated[str, Query(min_length=1, max_length=200)],
    limit: Annotated[int, Query(ge=1, le=1000)] = 50,
) -> dict:
    if mode == "recent" and not (value.isdigit() and 0 <= int(value) <= 168):
        raise HTTPException(status_code=422, detail="Para 'recent' el valor debe ser un número de horas entre 0 y 168.")
    if data.force_offline():
        return _offline(mode, value, limit)
    query, param = MODES[mode]
    form = {"query": query, param: value}
    if mode not in ("recent", "hash"):
        form["limit"] = str(limit)
    try:
        j = data.raw_query(form)
    except data.DataUnavailable as e:
        if data.snapshot_exists():
            return _offline(mode, value, limit)
        raise HTTPException(status_code=502, detail=str(e)) from e
    rows = j.get("data")
    if isinstance(rows, list) and mode == "recent":
        rows = rows[:limit]
    return {"query_status": j.get("query_status", "unknown"), "data": rows if isinstance(rows, list) else None}
