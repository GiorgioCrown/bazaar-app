"""Fixtures de prueba. El DataFrame sintético es SOLO para verificar fórmulas
(valores calculables a mano); la API real nunca usa datos inventados."""
from __future__ import annotations

import sys
import warnings
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient  # noqa: E402

from app import data  # noqa: E402


def make_records() -> list[dict]:
    """100 muestras: familia X (60) y Y (40); tipos exe/elf con proporciones conocidas.

    X: 30 exe + 30 elf.  Y: 10 exe + 30 elf.  ->  P(exe|X)=0.5, P(exe|Y)=0.25.
    Una de cada 2 X tiene ClamAV; Y nunca. Tamaños y horas deterministas.
    """
    recs = []
    i = 0
    for fam, ft, count in [("X", "exe", 30), ("X", "elf", 30), ("Y", "exe", 10), ("Y", "elf", 30)]:
        for j in range(count):
            i += 1
            recs.append(
                {
                    "sha256_hash": f"{i:064x}",
                    "first_seen": f"2026-01-01 {i % 5:02d}:{i % 60:02d}:00 UTC",
                    "file_name": f"f{i}",
                    "file_size": 1000 * (1 + i % 10) if ft == "elf" else 2 * 1024 * 1024,
                    "file_type": ft,
                    "signature": fam,
                    "tags": [fam, ft] if i % 2 else [fam],
                    "delivery_method": "web_download",
                    "reporter": "t",
                    "intelligence": {"clamav": ["Sig"] if (fam == "X" and j % 2 == 0) else None},
                }
            )
    return recs


@pytest.fixture()
def synthetic_df():
    return data.build_df(make_records())


@pytest.fixture()
def client(monkeypatch, synthetic_df):
    from app import (bayes, combinatorics, descriptive, families, main, positions,
                     probability, randvars, viz)

    ds = data.Dataset(synthetic_df, make_records(), True, "2026-01-01T00:00:00+00:00", 168)
    for mod in (bayes, combinatorics, descriptive, families, positions, probability, randvars, viz):
        monkeypatch.setattr(mod, "get_dataset", lambda hours, _ds=ds: _ds)
    monkeypatch.setattr("app.deps.get_dataset", lambda hours, _ds=ds: _ds)
    monkeypatch.setattr(main, "get_dataset", lambda hours, _ds=ds: _ds)
    return TestClient(main.app)
