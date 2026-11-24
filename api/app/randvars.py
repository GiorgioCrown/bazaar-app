"""/api/random-variables (sección 12): variables aleatorias discretas y continua.

X = muestras por hora (discreta; Poisson vs. Binomial Negativa)
Y = tamaño de archivo en bytes (continua; lognormal)
Z = tags por muestra (discreta; pmf empírica)
Los parámetros se estiman por momentos / máxima verosimilitud a partir de los datos.
"""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException
from scipy import stats

from .deps import Hours, get_dataset
from .descriptive import histogram
from .models import RandomVariables
from .util import clean
from .variables import build_vars

router = APIRouter(prefix="/api")

KIB, MIB = 1024, 1024 * 1024


def group_classes(expected: np.ndarray, minimum: float = 5.0) -> list[list[int]]:
    """Agrupa clases contiguas (de izquierda a derecha) hasta que E >= minimum; la cola sobrante se une a la última."""
    groups: list[list[int]] = []
    cur: list[int] = []
    acc = 0.0
    for i, e in enumerate(expected):
        cur.append(i)
        acc += e
        if acc >= minimum:
            groups.append(cur)
            cur, acc = [], 0.0
    if cur:
        if groups:
            groups[-1].extend(cur)
        else:
            groups.append(cur)
    return groups


def gof_chi2(freq: np.ndarray, dist, n_params: int, model: str) -> dict | None:
    """Chi² de bondad de ajuste con colas agrupadas. La última clase es P(X >= kmax)."""
    n = freq.sum()
    ks = np.arange(len(freq))
    probs = dist.pmf(ks)
    probs[-1] = dist.sf(ks[-1] - 1)  # cola completa en la última clase
    expected = n * probs
    groups = group_classes(expected)
    obs = np.array([freq[g].sum() for g in groups])
    exp = np.array([expected[g].sum() for g in groups])
    df = len(groups) - 1 - n_params
    if df < 1:
        return None
    chi2 = float(((obs - exp) ** 2 / exp).sum())
    return {"chi2": chi2, "df": int(df), "p_value": float(stats.chi2.sf(chi2, df)), "model": model}


def nb_params(mean: float, var: float) -> tuple[float, float] | None:
    """Binomial negativa por momentos: r = m²/(v−m), p = m/v (requiere v > m)."""
    if var <= mean or mean <= 0:
        return None
    return mean**2 / (var - mean), mean / var


def variable_x(x: np.ndarray) -> dict:
    n = len(x)
    mean, var = float(x.mean()), float(x.var(ddof=1))
    freq = np.bincount(x.astype(int))
    ks = np.arange(len(freq))
    emp = freq / n
    pois = stats.poisson(mean)
    nb = nb_params(mean, var)
    nbd = stats.nbinom(*nb) if nb else None
    pmf = [
        {
            "k": int(k),
            "empirical": float(emp[k]),
            "poisson": float(pois.pmf(k)),
            "neg_binomial": float(nbd.pmf(k)) if nbd is not None else None,
        }
        for k in ks
    ]
    index = var / mean if mean > 0 else 0.0
    gof = gof_chi2(freq, pois, 1, f"Poisson(λ={mean:.2f})")
    gof_nb = gof_chi2(freq, nbd, 2, f"Binomial negativa(r={nb[0]:.2f}, p={nb[1]:.3f})") if nbd is not None else None
    cand = sorted({0, int(round(mean / 2)), int(round(mean)), int(round(1.5 * mean)), int(round(2 * mean)), int(round(3 * mean)), int(x.max())})
    tail = [
        {"k": k, "p_equal": float(np.mean(x == k)), "p_at_least": float(np.mean(x >= k))}
        for k in cand
        if k <= x.max()
    ]
    desc = (
        f"Número de muestras reportadas por hora UTC en la ventana (n = {n} horas). Variable aleatoria DISCRETA con soporte {{0, 1, 2, …}}. "
        f"E[X] = {mean:.2f}, Var[X] = {var:.2f}, índice de dispersión Var/E = {index:.2f} "
        + ("(≈1 sería compatible con Poisson; aquí hay sobredispersión: las llegadas vienen en ráfagas)." if index > 1.5 else "(cercano a 1: compatible con Poisson).")
    )
    if gof:
        desc += f" Bondad de ajuste Poisson: χ²={gof['chi2']:.1f}, gl={gof['df']}, p={gof['p_value']:.3g}."
    if gof_nb:
        desc += f" Binomial negativa (momentos): χ²={gof_nb['chi2']:.1f}, gl={gof_nb['df']}, p={gof_nb['p_value']:.3g}."
    return {
        "id": "X",
        "name": "X: muestras por hora",
        "description": desc,
        "kind": "discrete",
        "support": "{0, 1, 2, …} (enteros no negativos)",
        "mean": mean,
        "variance": var,
        "pmf": pmf,
        "lambda": mean,
        "dispersion_index": index,
        "gof": gof,
        "tail": tail,
    }


def variable_y(y: np.ndarray) -> dict:
    zeros = int((y <= 0).sum())
    y = y[y > 0]  # ln no está definido en 0: esas muestras se excluyen y se declara
    n = len(y)
    ln = np.log(y)
    mu, sigma = float(ln.mean()), float(ln.std(ddof=1))
    dist = stats.lognorm(s=sigma, scale=np.exp(mu))
    xs = np.logspace(np.log10(y.min()), np.log10(y.max()), 80)
    ys = np.sort(y)
    ecdf = np.searchsorted(ys, xs, side="right") / n
    # pdf respecto a log10(x): f_{log10 Y}(t) = f_Y(x)·x·ln(10)
    pdf_log = dist.pdf(xs) * xs * np.log(10)
    ks_stat, ks_p = stats.kstest(y, dist.cdf)
    probs = [
        ("P(Y < 100 KiB)", dist.cdf(100 * KIB), float(np.mean(y < 100 * KIB))),
        ("P(100 KiB ≤ Y ≤ 1 MiB)", dist.cdf(MIB) - dist.cdf(100 * KIB), float(np.mean((y >= 100 * KIB) & (y <= MIB)))),
        ("P(Y > 1 MiB)", dist.sf(MIB), float(np.mean(y > MIB))),
        ("P(Y > 10 MiB)", dist.sf(10 * MIB), float(np.mean(y > 10 * MIB))),
    ]
    desc = (
        f"Tamaño en bytes de las muestras (n = {n}). Variable aleatoria CONTINUA con soporte (0, ∞). "
        f"Si ln Y ~ Normal(μ={mu:.2f}, σ={sigma:.2f}) entonces Y es lognormal con mediana e^μ = {np.exp(mu):,.0f} B. "
        f"Prueba de Kolmogorov–Smirnov: D={ks_stat:.3f}, p={ks_p:.3g}"
        + (" (se rechaza el ajuste lognormal: hay muchos tamaños repetidos y varias poblaciones de malware mezcladas)." if ks_p < 0.05 else " (no se rechaza el ajuste).")
        + (f" Se excluyeron {zeros} muestra(s) de tamaño 0 (ln no definido)." if zeros else "")
        + " Nota: μ y σ se estiman con los mismos datos, por lo que el p-valor de KS es optimista."
    )
    return {
        "id": "Y",
        "name": "Y: tamaño de archivo (bytes)",
        "description": desc,
        "kind": "continuous",
        "support": "(0, ∞) bytes",
        "mean": float(y.mean()),
        "variance": float(y.var(ddof=1)),
        "lognormal": {"mu": mu, "sigma": sigma},
        "curve": [
            {"x": float(x), "pdf_log": float(p), "cdf_empirical": float(e), "cdf_model": float(dist.cdf(x))}
            for x, p, e in zip(xs, pdf_log, ecdf)
        ],
        "histogram": histogram(y, "log", False),
        "ks": {"statistic": float(ks_stat), "p_value": float(ks_p)},
        "probabilities": [{"label": lab, "p_model": float(pm), "p_empirical": pe} for lab, pm, pe in probs],
    }


def variable_z(z: np.ndarray) -> dict:
    n = len(z)
    freq = np.bincount(z.astype(int))
    mean, var = float(z.mean()), float(z.var(ddof=1))
    return {
        "id": "Z",
        "name": "Z: tags por muestra",
        "description": (
            f"Número de etiquetas (tags) que MalwareBazaar asigna a cada muestra (n = {n}). Variable aleatoria DISCRETA con soporte "
            f"{{0, 1, …, {int(z.max())}}} observado. E[Z] = {mean:.2f}, Var[Z] = {var:.2f}."
        ),
        "kind": "discrete",
        "support": f"{{0, 1, 2, …}} (observado 0 a {int(z.max())})",
        "mean": mean,
        "variance": var,
        "pmf": [{"k": int(k), "empirical": float(c / n)} for k, c in enumerate(freq)],
    }


@router.get("/random-variables", response_model=RandomVariables, response_model_by_alias=True)
def random_variables(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    v = {x.key: x.values for x in build_vars(df)}
    if len(v["hourly_count"]) < 3 or len(v["file_size"]) < 3 or len(v["n_tags"]) < 3:
        raise HTTPException(status_code=422, detail="Muestra insuficiente en la ventana para ajustar las variables aleatorias.")
    return clean({"X": variable_x(v["hourly_count"]), "Y": variable_y(v["file_size"]), "Z": variable_z(v["n_tags"])})
