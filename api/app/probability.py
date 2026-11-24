"""/api/probability (secciones 8, 9 y 10): axiomas, independencia y probabilidad condicional.

Espacio muestral Ω = muestras con metadatos completos (ver docs/api-contract.md).
Todas las probabilidades son frecuencias relativas: P(E) = |E| / |Ω|.
"""
from __future__ import annotations

from itertools import combinations

import numpy as np
import pandas as pd
from fastapi import APIRouter
from scipy import stats

from .deps import Hours, get_dataset
from .models import Probability
from .util import clean

router = APIRouter(prefix="/api")

MIB = 1024 * 1024
EPS = 1e-12
IDS = ["A", "B", "C", "D", "E", "F"]


def omega(df: pd.DataFrame) -> pd.DataFrame:
    """Muestras con metadatos completos (Ω de las secciones 8-11)."""
    return df[df["enriched"]].reset_index(drop=True)


def build_events(om: pd.DataFrame) -> tuple[dict[str, np.ndarray], dict[str, tuple[str, str]], str]:
    """Máscaras booleanas de cada evento + (nombre, descripción)."""
    lead = om["family"].value_counts().index[0] if om["family"].notna().any() else "(ninguna)"
    masks = {
        "A": om["file_type"].isin(["exe", "dll"]).to_numpy(),
        "B": (om["family"] == lead).fillna(False).to_numpy(dtype=bool),
        "C": (om["file_size"] > MIB).fillna(False).to_numpy(dtype=bool),
        "D": (om["n_tags"] > 0).fillna(False).to_numpy(dtype=bool),
        "E": om["clamav"].fillna(False).to_numpy(dtype=bool),
        "F": om["family"].isna().to_numpy(),
    }
    info = {
        "A": ("Ejecutable PE (exe/dll)", "file_type es exe o dll (formato Portable Executable de Windows)."),
        "B": (f"Familia líder: {lead}", f"La firma (signature) es {lead}, la familia más frecuente de la ventana."),
        "C": ("Tamaño > 1 MiB", "file_size mayor que 1 048 576 bytes."),
        "D": ("Con tags", "La muestra tiene al menos una etiqueta (tag) en MalwareBazaar."),
        "E": ("Detectada por ClamAV", "intelligence.clamav contiene al menos una firma."),
        "F": ("Sin familia", "signature nula: muestra sin clasificar."),
    }
    return masks, info, lead


def independence_test(a: np.ndarray, b: np.ndarray) -> dict:
    """Prueba de independencia sobre la tabla 2x2 de A y B.

    - Si algún evento es imposible o seguro (marginal nula) no hay prueba: se
      reporta ``test="degenerate"``; matemáticamente P(A∩B)=P(A)P(B) se cumple.
    - Si alguna frecuencia esperada < 5, el χ² de Pearson no es fiable: el
      p-valor es el de la prueba exacta de Fisher (``test="fisher"``).
    - En otro caso χ² de Pearson sin corrección de Yates (``test="chi2"``).
    El χ² (y las esperadas mínimas) se informan siempre que estén definidos.
    """
    t = np.array(
        [
            [np.sum(a & b), np.sum(a & ~b)],
            [np.sum(~a & b), np.sum(~a & ~b)],
        ]
    )
    if (t.sum(axis=0) == 0).any() or (t.sum(axis=1) == 0).any():
        return {"chi2": None, "p_value": None, "test": "degenerate", "min_expected": None}
    chi2, p, _, expected = stats.chi2_contingency(t, correction=False)
    min_e = float(expected.min())
    test = "chi2"
    if min_e < 5:
        test, p = "fisher", float(stats.fisher_exact(t)[1])
    return {"chi2": float(chi2), "p_value": float(p), "test": test, "min_expected": min_e}


def axiom_checks(om: pd.DataFrame, masks: dict, info: dict, p: dict[str, float], n: int) -> tuple[list[dict], float]:
    checks: list[dict] = []

    def add(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    # Axioma 1: 0 <= P(E) <= 1
    ok = all(0 <= v <= 1 for v in p.values())
    rng = ", ".join(f"P({k})={p[k]:.4f}" for k in IDS)
    add("Axioma 1: 0 ≤ P(E) ≤ 1", ok, f"Todos los eventos están en [0,1]: {rng}.")

    # Axioma 2: P(Ω) = 1
    p_omega = float(len(om) / n) if n else 0.0
    add("Axioma 2: P(Ω) = 1", abs(p_omega - 1) < EPS, f"|Ω| = {n} muestras con metadatos; P(Ω) = {n}/{n} = {p_omega:.4f}.")

    # Partición por familias (incluye "Sin clasificar")
    part = om["family"].fillna("Sin clasificar").value_counts()
    psum = float((part / n).sum()) if n else 0.0
    add(
        "Partición por familias: Σ P(familia) = 1",
        abs(psum - 1) < EPS,
        f"{len(part)} clases mutuamente excluyentes (incluye 'Sin clasificar'); la suma de sus probabilidades es {psum:.6f}.",
    )

    # Axioma 3: aditividad para eventos disjuntos (dos familias distintas)
    fam = om["family"].value_counts()
    if len(fam) >= 2:
        f1, f2 = fam.index[0], fam.index[1]
        m1, m2 = (om["family"] == f1).to_numpy(), (om["family"] == f2).to_numpy()
        lhs, rhs = (m1 | m2).sum() / n, m1.sum() / n + m2.sum() / n
        add(
            "Axioma 3: aditividad de eventos disjuntos",
            abs(lhs - rhs) < EPS and not (m1 & m2).any(),
            f"{f1} y {f2} no pueden coincidir: P({f1} ∪ {f2}) = {lhs:.4f} = P({f1}) + P({f2}) = {rhs:.4f}.",
        )
    disjoint = [(a, b) for a, b in combinations(IDS, 2) if not (masks[a] & masks[b]).any()]
    if disjoint:
        a, b = disjoint[0]
        lhs, rhs = (masks[a] | masks[b]).sum() / n, p[a] + p[b]
        add(
            f"Aditividad observada: {a} y {b} son disjuntos",
            abs(lhs - rhs) < EPS,
            f"P({a}∪{b}) = {lhs:.4f} = P({a}) + P({b}) = {rhs:.4f} (|{a}∩{b}| = 0).",
        )

    # Complemento
    err = max(abs((~masks[k]).sum() / n - (1 - p[k])) for k in IDS)
    add("Complemento: P(Eᶜ) = 1 − P(E)", err < EPS, f"Para los 6 eventos, el conteo directo de Eᶜ coincide con 1 − P(E) (error máx. {err:.1e}).")

    # Inclusión-exclusión
    worst, worst_pair = 0.0, ("A", "B")
    for a, b in combinations(IDS, 2):
        pab = (masks[a] & masks[b]).sum() / n
        e = abs((masks[a] | masks[b]).sum() / n - (p[a] + p[b] - pab))
        if e >= worst:
            worst, worst_pair = e, (a, b)
    a, b = worst_pair
    add(
        "Inclusión-exclusión: P(A∪B) = P(A)+P(B)−P(A∩B)",
        worst < EPS,
        f"Verificado en los 15 pares de eventos (error máx. {worst:.1e}); p. ej. P(A∪C) = "
        f"{(masks['A'] | masks['C']).sum() / n:.4f} = {p['A']:.4f} + {p['C']:.4f} − {(masks['A'] & masks['C']).sum() / n:.4f}.",
    )
    return checks, psum


def family_given_file_type(om: pd.DataFrame) -> dict:
    fams = om["family"].dropna().value_counts().head(6).index.tolist()
    fts = om["file_type"].dropna().value_counts().head(6).index.tolist()
    ft_counts = [int((om["file_type"] == t).sum()) for t in fts]
    mat = [
        [float(((om["family"] == f) & (om["file_type"] == t)).sum() / c) if c else 0.0 for t, c in zip(fts, ft_counts)]
        for f in fams
    ]
    return {"families": fams, "file_types": fts, "p": mat, "file_type_counts": ft_counts}


@router.get("/probability", response_model=Probability)
def probability(hours: Hours = 168) -> dict:
    om = omega(get_dataset(hours).df)
    n = len(om)
    if n == 0:
        from fastapi import HTTPException

        raise HTTPException(status_code=422, detail="No hay muestras con metadatos completos en la ventana.")
    masks, info, _ = build_events(om)
    cnt = {k: int(masks[k].sum()) for k in IDS}
    p = {k: cnt[k] / n for k in IDS}
    events = [{"id": k, "name": info[k][0], "description": info[k][1], "count": cnt[k], "p": p[k]} for k in IDS]

    checks, psum = axiom_checks(om, masks, info, p, n)

    indep = []
    for a, b in combinations(IDS, 2):
        pab = float((masks[a] & masks[b]).sum() / n)
        prod = p[a] * p[b]
        it = independence_test(masks[a], masks[b])
        pv = it["p_value"]
        indep.append(
            {
                "a": a,
                "b": b,
                "p_a": p[a],
                "p_b": p[b],
                "p_ab": pab,
                "p_a_times_p_b": prod,
                "abs_diff": abs(pab - prod),
                "lift": pab / prod if prod > 0 else None,
                "chi2": it["chi2"],
                "p_value": pv,
                "test": it["test"],
                "min_expected": it["min_expected"],
                "independent": True if pv is None else pv >= 0.05,
            }
        )

    matrix = [
        [(float((masks[r] & masks[c]).sum() / cnt[c]) if cnt[c] else None) for c in IDS]
        for r in IDS
    ]
    return clean(
        {
            "n": n,
            "events": events,
            "axioms": {"checks": checks, "partition_sum": psum},
            "independence": indep,
            "conditional": {"events": IDS, "matrix": matrix, "family_given_file_type": family_given_file_type(om)},
        }
    )
