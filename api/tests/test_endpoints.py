"""Pruebas de endpoints sobre el DataFrame sintético (resultados calculados a mano)."""
from __future__ import annotations

import math

import pytest


def get(client, path, **params):
    r = client.get(path, params=params)
    assert r.status_code == 200, r.text
    assert "NaN" not in r.text and "Infinity" not in r.text
    return r.json()


# ---------------------------------------------------------------- 5 combinatoria
def test_calc_valores_exactos(client):
    j = get(client, "/api/combinatorics/calc", n=5, k=2)
    assert j["permutations"] == "20" and j["combinations"] == "10"
    assert j["permutations_with_repetition"] == "25" and j["factorial_n"] == "120"
    assert j["log10"]["combinations"] == pytest.approx(1.0)


def test_calc_enteros_enormes_como_string(client):
    j = get(client, "/api/combinatorics/calc", n=1000, k=500)
    assert j["factorial_n"] == str(math.factorial(1000)) and len(j["factorial_n"]) == 2568
    assert j["combinations"] == str(math.comb(1000, 500))


def test_calc_validacion(client):
    assert client.get("/api/combinatorics/calc", params={"n": 3, "k": 5}).status_code == 422
    assert client.get("/api/combinatorics/calc", params={"n": 5001, "k": 1}).status_code == 422


def test_combinatoria_perfiles_y_podio(client):
    j = get(client, "/api/combinatorics")
    assert "hypergeometric" not in j["combinations"]
    # 2 familias -> P(2,2) = 2 rankings; perfiles posibles = 2 * 2 tipos * 1 vía * 2 clamav
    assert j["counting"]["possible_profiles"] == "8"
    assert j["permutations"]["observed_podium"][0] == {"family": "X", "count": 60}


# ---------------------------------------------------------------- 8-10 probabilidad
def test_axiomas_y_eventos(client):
    j = get(client, "/api/probability")
    assert j["n"] == 100
    ev = {e["id"]: e for e in j["events"]}
    assert ev["B"]["count"] == 60 and ev["B"]["p"] == 0.6
    assert ev["A"]["count"] == 40  # 30 + 10 exe
    assert ev["E"]["count"] == 30  # la mitad de las 60 muestras X
    assert all(c["passed"] for c in j["axioms"]["checks"])
    assert j["axioms"]["partition_sum"] == pytest.approx(1.0)


def test_condicional_y_independencia(client):
    j = get(client, "/api/probability")
    ids = j["conditional"]["events"]
    m = j["conditional"]["matrix"]
    a, b = ids.index("A"), ids.index("B")
    # P(A|B) = P(exe | X) = 30/60 ; P(B|A) = 30/40
    assert m[a][b] == pytest.approx(0.5) and m[b][a] == pytest.approx(0.75)
    pair = next(p for p in j["independence"] if (p["a"], p["b"]) == ("A", "B"))
    assert pair["p_ab"] == pytest.approx(0.3)
    assert pair["p_a_times_p_b"] == pytest.approx(0.4 * 0.6)
    assert pair["abs_diff"] == pytest.approx(0.06)
    assert pair["independent"] is False  # |0.06| > 0.01
    assert set(pair) == {"a", "b", "p_a", "p_b", "p_ab", "p_a_times_p_b", "abs_diff", "independent"}
    f = j["conditional"]["family_given_file_type"]
    i, k = f["families"].index("X"), f["file_types"].index("exe")
    assert f["p"][i][k] == pytest.approx(0.75)  # P(X | exe) = 30/40


# ---------------------------------------------------------------- 11 Bayes
def test_bayes_a_mano(client):
    # P(X)=0.6, P(Y)=0.4; P(exe|X)=0.5, P(exe|Y)=0.25
    # P(exe)=0.4 ; P(X|exe)=0.3/0.4=0.75
    j = get(client, "/api/bayes", evidence="file_type:exe")
    st = j["steps"][0]
    assert st["marginal"] == pytest.approx(0.4)
    rows = {r["hypothesis"]: r for r in st["rows"]}
    assert rows["X"]["likelihood"] == pytest.approx(0.5)
    assert rows["X"]["joint"] == pytest.approx(0.3)
    assert rows["X"]["posterior"] == pytest.approx(0.75)
    assert sum(r["posterior"] for r in st["rows"]) == pytest.approx(1.0)
    assert {p["hypothesis"]: p["p"] for p in j["posterior"]}["Y"] == pytest.approx(0.25)


def test_bayes_encadenado_y_sin_evidencia(client):
    j = get(client, "/api/bayes", evidence=["file_type:exe", "clamav:true"])
    assert len(j["steps"]) == 2
    # tras exe: P(X)=0.75, P(Y)=0.25. P(clamav|X)=0.5, P(clamav|Y)=0 -> posterior X = 1
    assert {p["hypothesis"]: p["p"] for p in j["posterior"]}["X"] == pytest.approx(1.0)
    assert j["steps"][1]["rows"][0]["prior"] == pytest.approx(0.75)
    base = get(client, "/api/bayes")
    assert base["steps"] == [] and base["posterior"] == base["prior"]


def test_bayes_errores(client):
    assert client.get("/api/bayes", params={"evidence": "foo:bar"}).status_code == 422
    assert client.get("/api/bayes", params={"evidence": "sin_dos_puntos"}).status_code == 422
    assert client.get("/api/bayes", params={"evidence": "file_type:inexistente"}).status_code == 422


# ---------------------------------------------------------------- 6, 7, 12, 13
def test_descriptiva_y_posiciones_endpoints(client):
    d = get(client, "/api/descriptive")
    assert [v["key"] for v in d["variables"]] == ["file_size", "hourly_count", "family_count", "n_tags"]
    fc = next(v for v in d["variables"] if v["key"] == "family_count")
    assert fc["n"] == 2 and fc["mean"] == 50.0 and fc["median"] == 50.0
    p = get(client, "/api/positions")
    fcp = next(v for v in p["variables"] if v["key"] == "family_count")
    assert fcp["quartiles"]["q2"] == 50.0 and set(fcp["deciles"]) == {f"d{i}" for i in range(1, 10)}


def test_variables_aleatorias_endpoint(client):
    j = get(client, "/api/random-variables")
    assert j["X"]["kind"] == "discrete" and "lambda" not in j["X"] and j["X"]["std"] >= 0
    assert j["Y"]["kind"] == "continuous" and j["Z"]["kind"] == "discrete"
    assert sum(p["empirical"] for p in j["Z"]["pmf"]) == pytest.approx(1.0)
    cdf = [c["cdf_empirical"] for c in j["Y"]["cdf"]]
    assert len(cdf) == 80 and cdf == sorted(cdf) and cdf[-1] == 1.0
    assert len(j["Y"]["probabilities"]) == 4 and "ks" not in j["Y"]


def test_viz_y_familias(client):
    v = get(client, "/api/viz")
    assert v["families"][0] == "X" and len(v["family_hour_matrix"][0]) == len(v["hours"])
    assert sum(sum(r) for r in v["family_hour_matrix"]) == 100
    f = get(client, "/api/families")
    assert f["families"][0]["count"] == 60 and f["families"][0]["p"] == pytest.approx(0.6)
    assert set(f["families"][0]) == {"family", "count", "p", "first_seen", "last_seen"}
    assert set(f) == {"families", "top5_share", "hourly", "file_types"}
    assert f["top5_share"] == pytest.approx(1.0)
    o = get(client, "/api/overview")
    assert "lambda_total" not in o and o["avg_per_hour"] > 0
    assert o["total"] == 100 and o["classified"] == 100 and o["enriched"] == 100


def test_denominador_omega_declarado(client):
    p = get(client, "/api/probability")
    assert "Ω = 100 de las 100" in p["note"]
    assert "Ω = 100 de las 100" in get(client, "/api/bayes")["note"]


def test_combinatoria_declara_denominador_de_perfiles(client):
    j = get(client, "/api/combinatorics")
    prod = next(i for i in j["counting"]["items"] if i["id"] == "counting_product")
    assert "100 muestras con metadatos completos" in prod["explanation"]


def test_bayes_rechaza_evidencia_malformada_o_excesiva(client):
    for ev in (["x"], ["foo:bar"], ["clamav:maybe"], ["size_band:huge"], ["file_type:" + "a" * 200], ["file_type:exe"] * 11):
        r = client.get("/api/bayes", params={"evidence": ev})
        assert r.status_code == 422 and "detail" in r.json(), ev
    # inyección: se trata como texto literal -> P(e)=0 -> 422, nunca se evalúa
    r = client.get("/api/bayes", params={"evidence": ["tag:'; DROP TABLE x;--"]})
    assert r.status_code == 422
    assert client.get("/api/bayes", params={"evidence": ["file_type:exe"] * 10}).status_code == 200
