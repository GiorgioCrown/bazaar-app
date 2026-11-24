"""Carga de datos reales de MalwareBazaar (abuse.ch) -> DataFrame de pandas.

Flujo:
1. `recent_detections&hours=N` entrega hash, first_seen, file_name y firma
   (familia). NO trae tamano, tipo, tags ni ClamAV.
2. Se enriquece con consultas reales (`get_siginfo` por familia,
   `get_file_type` por tipo y `get_recent`), que devuelven la muestra completa,
   y se une por sha256. Las filas sin enriquecer conservan NA en esas columnas
   (nunca se inventa nada).
3. Cache en memoria de 5 min por `hours`; modo offline con
   `api/data/snapshot.json` (copia real de la API).
"""
from __future__ import annotations

import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

API_URL = "https://mb-api.abuse.ch/api/v1/"
ROOT = Path(__file__).resolve().parents[2]  # raiz del proyecto
SNAPSHOT_PATH = Path(__file__).resolve().parents[1] / "data" / "snapshot.json"
CACHE_TTL = 300  # 5 min
ENRICH_TTL = 1800  # 30 min
UNCLASSIFIED = "Sin clasificar"
ENRICH_FILE_TYPES = [
    "exe", "dll", "elf", "sh", "zip", "js", "ps1", "msi", "apk", "rar",
    "doc", "xls", "pdf", "bat", "vbs", "lnk", "iso", "7z", "gz", "html",
]
KEEP_FIELDS = (
    "sha256_hash", "md5_hash", "sha1_hash", "first_seen", "file_name",
    "file_size", "file_type", "file_type_mime", "reporter", "signature",
    "tags", "delivery_method",
)


class DataUnavailable(Exception):
    """No hay datos reales disponibles (sin key, sin red y sin snapshot)."""


# ---------------------------------------------------------------- entorno
def _read_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def auth_key() -> str | None:
    key = os.environ.get("ABUSECH_AUTH_KEY")
    if key:
        return key
    for name in (".env.local", ".env"):
        v = _read_env_file(ROOT / name).get("ABUSECH_AUTH_KEY")
        if v:
            return v
    return None


def snapshot_exists() -> bool:
    return SNAPSHOT_PATH.exists()


def force_offline() -> bool:
    if os.environ.get("BAZAAR_OFFLINE") == "1":
        return True
    return auth_key() is None and snapshot_exists()


# ---------------------------------------------------------------- abuse.ch
def _post(form: dict[str, Any], retries: int = 4) -> dict[str, Any]:
    key = auth_key()
    if not key:
        raise DataUnavailable("Falta ABUSECH_AUTH_KEY en .env.local y no hay snapshot.")
    last = "sin respuesta"
    for attempt in range(retries):
        try:
            r = httpx.post(API_URL, data=form, headers={"Auth-Key": key}, timeout=90)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}"
        except (httpx.HTTPError, ValueError) as e:  # red o JSON inválido
            last = type(e).__name__
        time.sleep(1.5 * (attempt + 1))
    raise DataUnavailable(f"abuse.ch no respondió correctamente ({last}).")


def raw_query(form: dict[str, Any]) -> dict[str, Any]:
    """Consulta cruda (usada por /api/search)."""
    return _post(form)


def _trim(rec: dict[str, Any]) -> dict[str, Any]:
    out = {k: rec[k] for k in KEEP_FIELDS if k in rec}
    intel = rec.get("intelligence") or {}
    out["intelligence"] = {"clamav": intel.get("clamav")}
    return out


_enrich_lock = threading.Lock()
_enrich: dict[str, Any] = {"at": 0.0, "records": {}, "sigs": set()}


def _enrichment(base: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Metadatos reales por sha256. La caché (30 min) recuerda qué familias ya se
    consultaron: una ventana corta no debe dejar sin enriquecer a las familias
    que solo alcanzan >= 5 muestras en una ventana mayor."""
    with _enrich_lock:
        fresh = time.time() - _enrich["at"] < ENRICH_TTL and bool(_enrich["records"])
        counts: dict[str, int] = {}
        for s in base:
            if s.get("signature"):
                counts[s["signature"]] = counts.get(s["signature"], 0) + 1
        needed = [s for s, c in sorted(counts.items(), key=lambda x: -x[1]) if c >= 5]
        todo = [s for s in needed if not fresh or s not in _enrich["sigs"]]
        if fresh and not todo:
            return _enrich["records"]
        jobs: list[tuple[str | None, dict[str, Any]]] = [
            (s, {"query": "get_siginfo", "signature": s, "limit": 1000}) for s in todo
        ]
        if not fresh:
            jobs += [(None, {"query": "get_file_type", "file_type": t, "limit": 1000}) for t in ENRICH_FILE_TYPES]
            jobs.append((None, {"query": "get_recent", "selector": "100"}))

        def run(job: tuple[str | None, dict[str, Any]]) -> tuple[str | None, bool, list[dict[str, Any]]]:
            try:
                return job[0], True, _post(job[1]).get("data") or []
            except DataUnavailable:
                return job[0], False, []

        records: dict[str, dict[str, Any]] = dict(_enrich["records"]) if fresh else {}
        done: set[str] = set(_enrich["sigs"]) if fresh else set()
        with ThreadPoolExecutor(4) as ex:
            for sig, ok, data in ex.map(run, jobs):
                if ok and sig:
                    done.add(sig)
                for s in data:
                    records[s["sha256_hash"]] = _trim(s)
        if records:
            _enrich.update(at=_enrich["at"] if fresh else time.time(), records=records, sigs=done)
        return records


def fetch_live(hours: int) -> list[dict[str, Any]]:
    """Muestras reales de la ventana, enriquecidas cuando es posible."""
    j = _post({"query": "recent_detections", "hours": str(hours)})
    base = j.get("data") or []
    if j.get("query_status") != "ok" and not base:
        raise DataUnavailable(f"abuse.ch devolvió query_status={j.get('query_status')}.")
    full = _enrichment(base)
    out = []
    for b in base:
        rec = dict(full.get(b["sha256_hash"], {}))
        rec.setdefault("sha256_hash", b["sha256_hash"])
        for k in ("md5_hash", "sha1_hash", "file_name", "signature"):
            if b.get(k) is not None:
                rec[k] = b[k]
        rec["first_seen"] = b.get("first_seen") or rec.get("first_seen")
        out.append(rec)
    return out


# ---------------------------------------------------------------- snapshot
def load_snapshot() -> dict[str, Any]:
    try:
        return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise DataUnavailable("No hay snapshot válido en api/data/snapshot.json.") from e


def _parse_ts(s: str | None) -> pd.Timestamp | None:
    if not s:
        return None
    t = pd.to_datetime(str(s).replace(" UTC", ""), utc=True, errors="coerce")
    return None if pd.isna(t) else t


def _filter_hours(records: list[dict[str, Any]], hours: int) -> list[dict[str, Any]]:
    ts = [_parse_ts(r.get("first_seen")) for r in records]
    valid = [t for t in ts if t is not None]
    if not valid:
        return records
    cutoff = max(valid) - pd.Timedelta(hours=hours)
    return [r for r, t in zip(records, ts) if t is not None and t >= cutoff]


def save_snapshot() -> dict[str, Any]:
    """Guarda el ultimo dataset real (168 h) como snapshot."""
    ds = load(168, allow_offline=False)
    payload = {
        "query_status": "ok",
        "source": "mb-api.abuse.ch recent_detections + get_siginfo/get_file_type/get_recent",
        "fetched_at": ds.fetched_at,
        "hours": 168,
        "data": ds.records,
    }
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return {"saved": len(ds.records), "path": "api/data/snapshot.json", "fetched_at": ds.fetched_at}


# ---------------------------------------------------------------- DataFrame
COLUMNS = [
    "sha256", "first_seen", "family", "file_type", "file_size", "delivery_method",
    "reporter", "tags", "n_tags", "clamav", "hour", "enriched", "file_name",
]


def build_df(records: list[dict[str, Any]]) -> pd.DataFrame:
    rows = []
    for r in records:
        enriched = "file_size" in r and r.get("file_size") is not None
        sig = (r.get("signature") or "").strip() or None
        tags = r.get("tags")
        clam = (r.get("intelligence") or {}).get("clamav")
        rows.append(
            {
                "sha256": r.get("sha256_hash"),
                "first_seen": _parse_ts(r.get("first_seen")),
                "family": sig,
                "file_type": (r.get("file_type") or None) if enriched else None,
                "file_size": r.get("file_size") if enriched else None,
                "delivery_method": (r.get("delivery_method") or "desconocido") if enriched else None,
                "reporter": r.get("reporter") if enriched else None,
                "tags": list(tags) if tags else [],
                "n_tags": len(tags) if tags else 0,
                "clamav": bool(clam) if enriched else None,
                "enriched": enriched,
                "file_name": r.get("file_name"),
            }
        )
    df = pd.DataFrame(rows, columns=[c for c in COLUMNS if c != "hour"])
    df["first_seen"] = pd.to_datetime(df["first_seen"], utc=True)
    df["file_size"] = df["file_size"].astype("Int64")
    df["n_tags"] = df["n_tags"].astype("Int64").where(df["enriched"], pd.NA)
    df["clamav"] = df["clamav"].astype("boolean")
    df["hour"] = df["first_seen"].dt.floor("h")
    return df[COLUMNS]


# ---------------------------------------------------------------- cache
@dataclass
class Dataset:
    df: pd.DataFrame
    records: list[dict[str, Any]]
    offline: bool
    fetched_at: str
    hours: int
    stamp: float = field(default_factory=time.time)


_cache: dict[int, Dataset] = {}
_lock = threading.Lock()


def load(hours: int = 168, allow_offline: bool = True) -> Dataset:
    with _lock:
        hit = _cache.get(hours)
        if hit and time.time() - hit.stamp < CACHE_TTL:
            return hit
        records: list[dict[str, Any]] | None = None
        offline = False
        fetched = datetime.now(timezone.utc).isoformat(timespec="seconds")
        if allow_offline and force_offline():
            snap = load_snapshot()
            records, offline, fetched = _filter_hours(snap["data"], hours), True, snap.get("fetched_at", fetched)
        else:
            try:
                records = fetch_live(hours)
            except DataUnavailable:
                if allow_offline and snapshot_exists():
                    snap = load_snapshot()
                    records, offline, fetched = _filter_hours(snap["data"], hours), True, snap.get("fetched_at", fetched)
                else:
                    raise
        ds = Dataset(build_df(records), records, offline, fetched, hours)
        _cache[hours] = ds
        return ds


def load_df(hours: int = 168) -> pd.DataFrame:
    return load(hours).df


def rows_cached() -> int:
    return sum(len(d.df) for d in _cache.values())


def search_snapshot(mode: str, value: str, limit: int) -> list[dict[str, Any]]:
    """Version offline del explorador: filtra el snapshot real."""
    recs = load_snapshot()["data"]
    v = value.strip().lower()
    if mode == "recent":
        out = recs
    elif mode == "hash":
        out = [r for r in recs if v in (r.get("sha256_hash", ""), r.get("md5_hash", ""), r.get("sha1_hash", ""))]
    elif mode == "tag":
        out = [r for r in recs if v in [t.lower() for t in r.get("tags") or []]]
    elif mode == "signature":
        out = [r for r in recs if (r.get("signature") or "").lower() == v]
    elif mode == "file_type":
        out = [r for r in recs if (r.get("file_type") or "").lower() == v]
    else:  # clamav
        out = [r for r in recs if v in [c.lower() for c in (r.get("intelligence") or {}).get("clamav") or []]]
    return out[:limit]
