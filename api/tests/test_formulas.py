"""Pruebas unitarias de fórmulas con valores conocidos a mano."""
from __future__ import annotations

import math

import numpy as np
import pytest
from scipy import stats

from app.descriptive import describe, histogram
from app.families import dispersion_test, wilson
from app.positions import position
from app.randvars import gof_chi2, group_classes, nb_params, variable_x
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
    assert d["cv"] == pytest.approx(d["std"] / 5.0)


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


# ---------------------------------------------------------------- familias
def test_wilson_conocido():
    lo, hi = wilson(50, 100)
    assert lo == pytest.approx(0.4038, abs=1e-4) and hi == pytest.approx(0.5962, abs=1e-4)
    assert wilson(0, 0) == (0.0, 0.0)


def test_dispersion_poisson_vs_sobredispersion():
    import pandas as pd

    flat = dispersion_test(pd.Series([5, 5, 5, 5, 5]))
    assert flat["index"] == 0.0
    bursty = dispersion_test(pd.Series([0, 0, 0, 40, 0, 0, 0, 40]))
    assert bursty["index"] > 5 and bursty["p_value"] < 0.001


# ---------------------------------------------------------------- 12 v.a.
def test_pmf_empirica_y_poisson_suman_uno():
    x = np.random.default_rng(1).poisson(6, 400)
    r = variable_x(x.astype(float))
    assert sum(p["empirical"] for p in r["pmf"]) == pytest.approx(1.0)
    # la pmf Poisson completa suma 1 (la tabla solo llega hasta max(x))
    assert stats.poisson(r["lambda"]).pmf(np.arange(0, 200)).sum() == pytest.approx(1.0)
    assert r["dispersion_index"] == pytest.approx(x.var(ddof=1) / x.mean())


def test_binomial_negativa_por_momentos():
    r, p = nb_params(10.0, 40.0)
    assert r == pytest.approx(100 / 30) and p == pytest.approx(0.25)
    d = stats.nbinom(r, p)
    assert d.mean() == pytest.approx(10.0) and d.var() == pytest.approx(40.0)
    assert nb_params(10.0, 8.0) is None  # sin sobredispersión no aplica


def test_agrupacion_de_clases_esperado_minimo_5():
    groups = group_classes(np.array([1.0, 2.0, 3.0, 0.5, 0.2, 10.0, 1.0]))
    flat = [i for g in groups for i in g]
    assert flat == list(range(7))  # parte exacta
    assert all(sum(np.array([1.0, 2.0, 3.0, 0.5, 0.2, 10.0, 1.0])[g]) >= 5 for g in groups)


def test_gof_ajuste_perfecto_da_chi2_cero():
    d = stats.poisson(3)
    ks = np.arange(0, 12)
    freq = np.round(1000 * d.pmf(ks))
    freq[-1] += 1000 - freq.sum()
    g = gof_chi2(freq, d, 1, "Poisson")
    assert g["chi2"] < 2 and g["p_value"] > 0.9


# ---------------------------------------------------------------- util
def test_clean_elimina_nan_e_inf():
    out = clean({"a": float("nan"), "b": [float("inf"), 1.5], "c": np.int64(3), "d": np.float64("nan")})
    assert out == {"a": None, "b": [None, 1.5], "c": 3, "d": None}
