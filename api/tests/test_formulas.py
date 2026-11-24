"""Pruebas unitarias de fórmulas con valores conocidos a mano."""
from __future__ import annotations

import math

import numpy as np
import pytest

from app.descriptive import describe, histogram
from app.positions import position
from app.randvars import variable_x, variable_y, variable_z
from app.util import clean
from app.variables import Var


def var(values, kind="discrete", key="n_tags"):
    return Var(key, "t", "u", kind, np.array(values, dtype=float), "linear")


# ---------------------------------------------------------------- 6 descriptiva
def test_descriptiva_valores_conocidos():
    d = describe(var([2, 4, 4, 4, 5, 5, 7, 9]))
    assert d["mean"] == 5.0
    assert d["median"] == 4.5
    assert d["modes"] == [4.0] and d["mode_count"] == 3
    # suma de cuadrados = 32 -> varianza muestral 32/7 (ddof=1), no 32/8
    assert d["variance"] == pytest.approx(32 / 7)
    assert d["std"] == pytest.approx(math.sqrt(32 / 7))
    assert d["range"] == 7.0
    assert "cv" not in d and "skewness" not in d and "kurtosis" not in d


def test_multimodal_devuelve_todas_las_modas():
    d = describe(var([1, 1, 2, 2, 3]))
    assert d["modes"] == [1.0, 2.0]


def test_sin_moda_cuando_no_hay_repetidos():
    d = describe(var([1, 2, 3, 4]))
    assert d["modes"] == [] and d["mode_count"] == 1


def test_histograma_conserva_el_total_y_densidad_integra_uno():
    x = np.random.default_rng(0).lognormal(10, 1, 500)
    h = histogram(x, "log", False)
    assert sum(h["counts"]) == 500
    assert np.sum(np.array(h["density"]) * np.diff(h["edges"])) == pytest.approx(1.0)
    assert h["scale"] == "log"


def test_atipicos_regla_de_tukey():
    d = describe(var([1, 2, 3, 4, 5, 100]))
    assert d["outliers"]["count"] == 1


# ---------------------------------------------------------------- 7 posición
def test_cuartiles_metodo_lineal():
    p = position(var(range(1, 10)))  # 1..9
    assert (p["quartiles"]["q1"], p["quartiles"]["q2"], p["quartiles"]["q3"]) == (3.0, 5.0, 7.0)
    assert p["quartiles"]["iqr"] == 4.0
    assert p["deciles"]["d1"] == pytest.approx(1.8)  # h = 8*0.1 = 0.8 -> 1 + 0.8
    assert p["deciles"]["d5"] == 5.0
    assert p["highlights"]["p90"] == pytest.approx(8.2)
    assert len(p["percentiles"]) == 99 and p["percentiles"][49]["value"] == 5.0


def test_boxplot_bigotes_dentro_de_las_cercas():
    p = position(var([1, 2, 3, 4, 5, 100]))
    assert p["boxplot"]["max"] == 100.0
    assert p["boxplot"]["whisker_high"] == 5.0  # 100 queda fuera de la cerca


def test_rango_percentil():
    p = position(var(range(1, 11), key="n_tags"))
    ranks = {r["label"]: r["percentile_rank"] for r in p["rank_examples"]}
    assert ranks["2 tags"] == 20.0  # 2 de 10 datos son <= 2


# ---------------------------------------------------------------- 12 v.a.
def test_pmf_empirica_suma_uno_y_momentos():
    x = np.random.default_rng(1).poisson(6, 400).astype(float)
    r = variable_x(x)
    assert sum(p["empirical"] for p in r["pmf"]) == pytest.approx(1.0)
    assert r["mean"] == pytest.approx(x.mean()) and r["variance"] == pytest.approx(x.var(ddof=1))
    assert r["std"] == pytest.approx(math.sqrt(r["variance"]))
    # E[X] desde la pmf coincide con el promedio
    assert sum(p["k"] * p["empirical"] for p in r["pmf"]) == pytest.approx(x.mean())


def test_cola_discreta_p_al_menos_k():
    r = variable_z(np.array([0, 0, 1, 2, 2, 2], dtype=float))
    t = {c["k"]: c for c in r["tail"]}
    assert t[2]["p_equal"] == pytest.approx(0.5) and t[1]["p_at_least"] == pytest.approx(4 / 6)


def test_y_excluye_tamanos_cero_y_probabilidades_por_intervalos():
    v = variable_y(np.array([0.0, 10.0, 100.0, 1000.0, 5000.0]))
    assert len(v["cdf"]) == 80 and v["cdf"][-1]["cdf_empirical"] == 1.0
    assert v["probabilities"][0]["p_empirical"] == 1.0  # todos < 100 KiB
    assert np.isfinite(v["mean"]) and np.isfinite(v["std"])


# ---------------------------------------------------------------- util
def test_clean_elimina_nan_e_inf():
    out = clean({"a": float("nan"), "b": [float("inf"), 1.5], "c": np.int64(3), "d": np.float64("nan")})
    assert out == {"a": None, "b": [None, 1.5], "c": 3, "d": None}
