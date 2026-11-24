"""Pruebas de la capa de datos (DataFrame, snapshot y filtros) sin red."""
from __future__ import annotations

from app import data


def test_build_df_filas_sin_metadatos_conservan_na():
    recs = [
        {"sha256_hash": "a" * 64, "first_seen": "2026-01-01 10:15:00 UTC", "signature": "Mirai", "file_name": "x"},
        {
            "sha256_hash": "b" * 64, "first_seen": "2026-01-01 11:00:00 UTC", "signature": None,
            "file_size": 100, "file_type": "exe", "tags": ["t1", "t2"], "intelligence": {"clamav": ["S"]},
        },
    ]
    df = data.build_df(recs)
    assert list(df["enriched"]) == [False, True]
    assert df["file_size"].isna().tolist() == [True, False]
    assert df["family"].isna().tolist() == [False, True]
    assert df.loc[1, "n_tags"] == 2 and bool(df.loc[1, "clamav"]) is True
    assert str(df["hour"].iloc[0]) == "2026-01-01 10:00:00+00:00"


def test_filtro_de_horas_relativo_a_la_ultima_muestra():
    recs = [{"first_seen": f"2026-01-01 {h:02d}:30:00 UTC"} for h in range(10)]
    assert len(data._filter_hours(recs, 3)) == 4  # 06:30 .. 09:30 (>= cutoff)


def test_busqueda_offline_en_snapshot_real():
    if not data.snapshot_exists():
        return
    rows = data.search_snapshot("signature", "Mirai", 3)
    assert 0 < len(rows) <= 3 and all(r["signature"] == "Mirai" for r in rows)
    assert data.search_snapshot("hash", "no-existe", 5) == []


def test_parser_env_minimo(tmp_path):
    f = tmp_path / ".env.local"
    f.write_text('# c\nABUSECH_AUTH_KEY="abc123"\nOTRA=1\n', encoding="utf-8")
    assert data._read_env_file(f)["ABUSECH_AUTH_KEY"] == "abc123"


def test_enriquecimiento_no_depende_de_la_primera_ventana(monkeypatch):
    """Una ventana corta no debe impedir enriquecer familias de una ventana larga."""
    calls: list[dict] = []

    def fake_post(form, retries=4):
        calls.append(form)
        if form["query"] == "get_siginfo":
            sig = form["signature"]
            return {"data": [{"sha256_hash": f"{sig}-1", "file_size": 10, "signature": sig}]}
        return {"data": []}

    monkeypatch.setattr(data, "_post", fake_post)
    monkeypatch.setitem(data._enrich, "at", 0.0)
    monkeypatch.setitem(data._enrich, "records", {})
    monkeypatch.setitem(data._enrich, "sigs", set())
    corta = [{"signature": "A"}] * 5
    larga = corta + [{"signature": "B"}] * 5
    assert set(data._enrichment(corta)) == {"A-1"}
    assert set(data._enrichment(larga)) == {"A-1", "B-1"}  # B se consulta aunque la caché sea reciente
    n = len(calls)
    data._enrichment(larga)
    assert len(calls) == n  # ya cubierto: sin consultas nuevas


def test_guardar_snapshot_rechaza_datos_que_ya_son_snapshot(monkeypatch, tmp_path):
    import pytest

    ds = data.Dataset(data.build_df([]), [], True, "2026-01-01T00:00:00+00:00", 168)
    monkeypatch.setattr(data, "load", lambda hours, allow_offline=True: ds)
    monkeypatch.setattr(data, "SNAPSHOT_PATH", tmp_path / "snapshot.json")
    with pytest.raises(data.DataUnavailable):
        data.save_snapshot()
    assert not (tmp_path / "snapshot.json").exists()


def test_guardar_snapshot_en_vivo_es_atomico(monkeypatch, tmp_path):
    recs = [{"sha256_hash": "a" * 64, "first_seen": "2026-01-01 10:00:00 UTC", "signature": "X"}]
    ds = data.Dataset(data.build_df(recs), recs, False, "2026-01-01T00:00:00+00:00", 168)
    monkeypatch.setattr(data, "load", lambda hours, allow_offline=True: ds)
    monkeypatch.setattr(data, "SNAPSHOT_PATH", tmp_path / "snapshot.json")
    assert data.save_snapshot()["saved"] == 1
    assert data.load_snapshot()["data"] == recs
    assert [p.name for p in tmp_path.iterdir()] == ["snapshot.json"]
