"""/api/combinatorics y /api/combinatorics/calc (sección 5).

Todo con enteros de Python (precisión arbitraria): factoriales y combinaciones
enormes viajan como string decimal y se acompañan de log10.
"""
from __future__ import annotations

import math
from collections import Counter
from itertools import combinations as iter_combinations
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from scipy import stats

from .deps import Hours, get_dataset
from .models import CombCalc, Combinatorics
from .probability import omega
from .util import big_str, clean

router = APIRouter(prefix="/api")


def log10_of(x: int) -> float:
    return math.log10(x) if x > 0 else 0.0


def item(id_: str, title: str, formula: str, inputs: dict, result: int, explanation: str) -> dict:
    return {
        "id": id_,
        "title": title,
        "formula": formula,
        "inputs": inputs,
        "result": big_str(result),
        "log10": log10_of(result),
        "explanation": explanation,
    }


def fmt_big(x: int) -> str:
    """Texto legible: entero completo si es corto, notación científica si no."""
    s = big_str(x)
    if len(s) <= 12:
        return f"{x:,}".replace(",", " ")
    return f"{s[0]},{s[1:3]}×10^{len(s) - 1}"


# ------------------------------------------------------------------ cálculo libre
@router.get("/combinatorics/calc", response_model=CombCalc)
def calc(
    n: Annotated[int, Query(ge=0, le=5000)],
    k: Annotated[int, Query(ge=0, le=5000)],
) -> dict:
    if k > n:
        raise HTTPException(status_code=422, detail="k no puede ser mayor que n (k ≤ n).")
    perm, comb = math.perm(n, k), math.comb(n, k)
    return {
        "n": n,
        "k": k,
        "permutations": big_str(perm),
        "combinations": big_str(comb),
        "permutations_with_repetition": big_str(n**k),
        "factorial_n": big_str(math.factorial(n)),
        "log10": {"permutations": log10_of(perm), "combinations": log10_of(comb)},
    }


# ------------------------------------------------------------------ bloques
def counting_block(om: pd.DataFrame) -> dict:
    cols = [
        ("family", "Familia (signature)", om["family"].fillna("Sin clasificar")),
        ("file_type", "Tipo de archivo", om["file_type"]),
        ("delivery_method", "Vía de entrega", om["delivery_method"]),
        ("clamav", "Detección ClamAV (sí/no)", om["clamav"].map({True: "sí", False: "no"})),
    ]
    dims, card = [], []
    for key, _, s in cols:
        vc = s.value_counts()
        dims.append({"name": key, "cardinality": int(len(vc)), "values_sample": [str(v) for v in vc.index[:5]]})
        card.append(int(len(vc)))
    possible = math.prod(card)
    prof = pd.concat([s.rename(k) for k, _, s in cols], axis=1)
    pc = prof.value_counts()
    observed = int(len(pc))
    top = [{"profile": " | ".join(str(x) for x in idx), "count": int(c)} for idx, c in pc.head(8).items()]

    f, ft, dm, cl = card
    names = ["familias", "tipos de archivo", "vías de entrega", "estados ClamAV"]
    items = [
        item(
            "counting_product",
            "Principio fundamental del conteo (regla del producto)",
            "N = n₁ · n₂ · n₃ · n₄",
            {"familias": f, "tipos_de_archivo": ft, "vias_de_entrega": dm, "clamav": cl},
            possible,
            f"Un perfil elige una familia ({f}), un tipo de archivo ({ft}), una vía de entrega ({dm}) y un estado ClamAV ({cl}) "
            f"a la vez, así que hay {f}·{ft}·{dm}·{cl} = {fmt_big(possible)} perfiles posibles. En los datos solo aparecen "
            f"{observed} ({observed / possible:.2%}): los atributos están fuertemente correlacionados (no todo se combina con todo). "
            f"Cardinalidades y perfiles observados se cuentan solo sobre las {len(om)} muestras con metadatos completos "
            "(las permutaciones y la hipergeométrica usan todas las muestras con familia de la ventana).",
        ),
        item(
            "counting_sum",
            "Regla de la suma (alternativas excluyentes)",
            "N = n₁ + n₂",
            {"familias": f, "tipos_de_archivo": ft},
            f + ft,
            f"Si basta con elegir UNA característica (o una familia o un tipo de archivo, no ambos) hay {f} + {ft} = {f + ft} opciones; "
            f"si hay que elegir ambos a la vez la regla del producto da {f}·{ft} = {f * ft}. La suma se usa con 'o' excluyente, el producto con 'y'."
            + (f" Nota: en esta ventana la vía de entrega tiene {dm} valor(es) observado(s), por lo que apenas amplía el espacio de perfiles." if dm <= 1 else ""),
        ),
    ]
    return {
        "dimensions": dims,
        "possible_profiles": big_str(possible),
        "observed_profiles": observed,
        "observed_fraction": observed / possible if possible else 0.0,
        "top_profiles": top,
        "items": items,
    }


def permutations_block(df: pd.DataFrame) -> dict:
    fam = df["family"].dropna().value_counts()
    F = len(fam)
    items = []
    for k in range(1, 6):
        if k > F:
            break
        r = math.perm(F, k)
        items.append(
            item(
                f"perm_{k}",
                f"Permutaciones P({F},{k})",
                "P(n,k) = n! / (n−k)!",
                {"n": F, "k": k},
                r,
                f"Hay {F} familias distintas en la ventana; ordenar {k} de ellas (el orden importa: 1.º, 2.º…) "
                f"puede hacerse de {fmt_big(r)} maneras.",
            )
        )
    top5 = fam.head(5)
    items.append(
        item(
            "perm_top5",
            "Rankings posibles del top 5: 5!",
            "n! = n · (n−1) · … · 1",
            {"n": min(5, len(top5))},
            math.factorial(len(top5)),
            f"Las 5 familias más frecuentes ({', '.join(top5.index)}) podrían ordenarse de {math.factorial(len(top5))} formas; "
            "la realidad observó exactamente una de ellas.",
        )
    )
    podium = [{"family": f, "count": int(c)} for f, c in fam.head(3).items()]
    if F >= 3:
        total_podiums = math.perm(F, 3)
        items.append(
            item(
                "perm_podium",
                "Podio observado: P(F,3)",
                "P(n,3) = n·(n−1)·(n−2)",
                {"n": F, "k": 3},
                total_podiums,
                f"El podio real es {' > '.join(p['family'] for p in podium)}. Entre {fmt_big(total_podiums)} podios posibles, "
                f"si las familias fueran intercambiables elegir ese podio al azar tendría probabilidad 1/{fmt_big(total_podiums)}.",
            )
        )
    return {"items": items, "observed_podium": podium}


def combinations_block(df: pd.DataFrame, om: pd.DataFrame) -> dict:
    fam = df["family"].dropna().value_counts()
    F = len(fam)
    N = len(df)
    items = []
    for k in (2, 3):
        if k <= F:
            r = math.comb(F, k)
            items.append(
                item(
                    f"comb_fam_{k}",
                    f"Combinaciones C({F},{k}) de familias",
                    "C(n,k) = n! / (k!·(n−k)!)",
                    {"n": F, "k": k},
                    r,
                    f"Elegir {k} familias entre {F} sin importar el orden (un 'grupo' de familias) da {fmt_big(r)} grupos; "
                    f"son P({F},{k})/{k}! = {fmt_big(math.perm(F, k))}/{math.factorial(k)}.",
                )
            )
    draws = min(10, N)
    c_samples = math.comb(N, draws)
    items.append(
        item(
            "comb_samples",
            f"Selecciones de {draws} muestras entre {N}",
            "C(N,k) = N! / (k!·(N−k)!)",
            {"N": N, "k": draws},
            c_samples,
            f"Un analista que revisa {draws} muestras de las {N} de la ventana tiene {fmt_big(c_samples)} selecciones posibles "
            "(el orden no importa).",
        )
    )

    # Pares de tags co-ocurrentes
    pair_counts: Counter[tuple[str, str]] = Counter()
    all_tags: set[str] = set()
    for tags in om["tags"]:
        ts = sorted(set(tags))[:30]
        all_tags.update(ts)
        pair_counts.update(iter_combinations(ts, 2))
    t = len(all_tags)
    possible_pairs = math.comb(t, 2)
    items.append(
        item(
            "comb_tag_pairs",
            f"Pares de tags: C({t},2)",
            "C(t,2) = t·(t−1)/2",
            {"t": t, "pares_observados": len(pair_counts)},
            possible_pairs,
            f"Con {t} tags distintos hay {fmt_big(possible_pairs)} pares posibles, pero solo {len(pair_counts)} "
            f"({len(pair_counts) / possible_pairs:.2%} de los posibles) se observan juntos en alguna muestra." if possible_pairs else "No hay suficientes tags.",
        )
    )
    tag_pairs = [{"pair": [a, b], "count": int(c)} for (a, b), c in pair_counts.most_common(10)]

    # Hipergeométrica: P(al menos 1 de la familia líder en una selección de 10)
    lead, K = (fam.index[0], int(fam.iloc[0])) if F else ("(ninguna)", 0)
    pmf = stats.hypergeom(M=N, n=K, N=draws).pmf(list(range(draws + 1)))
    p_at_least = 1.0 - float(pmf[0])
    hg_num = math.comb(N - K, draws)
    items.append(
        item(
            "hypergeometric",
            f"Hipergeométrica: ≥1 muestra de {lead} en {draws}",
            "P(X=k) = C(K,k)·C(N−K,n−k) / C(N,n);  P(X≥1) = 1 − C(N−K,n)/C(N,n)",
            {"N": N, "K": K, "n": draws},
            hg_num,
            f"De {N} muestras, {K} son de {lead}. Al tomar {draws} sin reemplazo, P(ninguna de {lead}) = C({N - K},{draws})/C({N},{draws}) "
            f"= {1 - p_at_least:.4f}, así que P(al menos una) = {p_at_least:.4f}. El resultado mostrado es el numerador C(N−K,n).",
        )
    )
    return {
        "items": items,
        "tag_pairs": tag_pairs,
        "hypergeometric": {
            "population": N,
            "successes": K,
            "draws": draws,
            "family": lead,
            "p_at_least_one": p_at_least,
            "pmf": [{"k": k, "p": float(p)} for k, p in enumerate(pmf)],
        },
    }


@router.get("/combinatorics", response_model=Combinatorics)
def combinatorics(hours: Hours = 168) -> dict:
    df = get_dataset(hours).df
    om = omega(df)
    if len(om) == 0:
        raise HTTPException(status_code=422, detail="No hay muestras con metadatos completos en la ventana.")
    return clean(
        {
            "counting": counting_block(om),
            "permutations": permutations_block(df),
            "combinations": combinations_block(df, om),
        }
    )
