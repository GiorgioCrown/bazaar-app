"""Aplicacion FastAPI: analisis probabilistico de malware (MalwareBazaar)."""
from __future__ import annotations

import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import data
from .deps import Hours, get_dataset
from .models import Health, Overview
from .util import clean, fmt_utc, observed_hours

app = FastAPI(title="Bazaar PyE API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
    partes = [f"{'.'.join(str(x) for x in e['loc'][1:])}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": "Parámetros inválidos (" + "; ".join(partes) + ")"})


@app.get("/api/health", response_model=Health)
def health() -> dict:
    return {"status": "ok", "offline": data.force_offline(), "rows_cached": data.rows_cached()}


@app.get("/api/overview", response_model=Overview)
def overview(hours: Hours = 168) -> dict:
    ds = get_dataset(hours)
    df = ds.df
    total = len(df)
    classified = int(df["family"].notna().sum())
    obs = observed_hours(df)
    enriched = int(df["enriched"].sum())
    return clean(
        {
            "total": total,
            "classified": classified,
            "unclassified": total - classified,
            "window_hours_requested": hours,
            "window_hours_observed": obs,
            "window_start": fmt_utc(df["first_seen"].min()) if total else None,
            "window_end": fmt_utc(df["first_seen"].max()) if total else None,
            "distinct_families": int(df["family"].nunique()),
            "lambda_total": total / obs,
            "offline": ds.offline,
            "fetched_at": ds.fetched_at,
            "enriched": enriched,
            "enriched_fraction": enriched / total if total else 0.0,
        }
    )


@app.post("/api/snapshot")
def snapshot() -> dict:
    try:
        return data.save_snapshot()
    except data.DataUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


from . import bayes, combinatorics, descriptive, families, positions, probability, search, viz  # noqa: E402

for _r in (families.router, search.router, descriptive.router, positions.router, viz.router, probability.router, bayes.router, combinatorics.router):
    app.include_router(_r)
