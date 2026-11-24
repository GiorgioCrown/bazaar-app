"""Modelos Pydantic de respuesta (espejo de src/lib/api-types.ts)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

BigIntStr = str
VarKey = Literal["file_size", "hourly_count", "family_count", "n_tags"]
EventId = Literal["A", "B", "C", "D", "E", "F"]


class Health(BaseModel):
    status: Literal["ok"]
    offline: bool
    rows_cached: int


class Overview(BaseModel):
    total: int
    classified: int
    unclassified: int
    window_hours_requested: int
    window_hours_observed: float
    window_start: str | None
    window_end: str | None
    distinct_families: int
    lambda_total: float
    offline: bool
    fetched_at: str
    # Extras (documentados en el contrato): muestras con metadatos completos.
    enriched: int
    enriched_fraction: float


# ---------------------------------------------------------------- explorador
class Intelligence(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)  # abuse.ch mezcla int y str

    clamav: list[str] | None = None
    downloads: str | None = None
    uploads: str | None = None


class Sample(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    sha256_hash: str
    md5_hash: str | None = None
    sha1_hash: str | None = None
    first_seen: str | None = None
    last_seen: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    file_type: str | None = None
    file_type_mime: str | None = None
    reporter: str | None = None
    signature: str | None = None
    tags: list[str] | None = None
    imphash: str | None = None
    tlsh: str | None = None
    ssdeep: str | None = None
    delivery_method: str | None = None
    intelligence: Intelligence | None = None


class SearchResponse(BaseModel):
    query_status: str
    data: list[Sample] | None = None


# ---------------------------------------------------------------- familias
class FamilyStat(BaseModel):
    family: str
    count: int
    p: float
    ci_low: float
    ci_high: float
    rate_per_hour: float
    p_next_hour: float
    p_next_24h: float
    first_seen: str | None
    last_seen: str | None


class HourCount(BaseModel):
    hour: str
    count: int


class Dispersion(BaseModel):
    index: float
    chi2: float
    df: int
    p_value: float | None


class FileTypeShare(BaseModel):
    type: str
    count: int
    p: float


class Families(BaseModel):
    families: list[FamilyStat]
    entropy: float
    entropy_norm: float
    gini_simpson: float
    top5_share: float
    hourly: list[HourCount]
    dispersion: Dispersion | None
    file_types: list[FileTypeShare]


# ---------------------------------------------------------------- 5 combinatoria
class CombItem(BaseModel):
    id: str
    title: str
    formula: str
    inputs: dict[str, int | float | str]
    result: BigIntStr
    log10: float
    explanation: str


class CountDimension(BaseModel):
    name: str
    cardinality: int
    values_sample: list[str]


class ProfileCount(BaseModel):
    profile: str
    count: int


class Counting(BaseModel):
    dimensions: list[CountDimension]
    possible_profiles: BigIntStr
    observed_profiles: int
    observed_fraction: float
    top_profiles: list[ProfileCount]
    items: list[CombItem]


class FamilyCount(BaseModel):
    family: str
    count: int


class Permutations(BaseModel):
    items: list[CombItem]
    observed_podium: list[FamilyCount]


class TagPair(BaseModel):
    pair: tuple[str, str]
    count: int


class HyperPmf(BaseModel):
    k: int
    p: float


class Hypergeometric(BaseModel):
    population: int
    successes: int
    draws: int
    family: str
    p_at_least_one: float
    pmf: list[HyperPmf]


class Combinations(BaseModel):
    items: list[CombItem]
    tag_pairs: list[TagPair]
    hypergeometric: Hypergeometric


class Combinatorics(BaseModel):
    counting: Counting
    permutations: Permutations
    combinations: Combinations


class CombLog10(BaseModel):
    permutations: float
    combinations: float


class CombCalc(BaseModel):
    n: int
    k: int
    permutations: BigIntStr
    combinations: BigIntStr
    permutations_with_repetition: BigIntStr
    factorial_n: BigIntStr
    log10: CombLog10


# ---------------------------------------------------------------- 6 descriptiva
class Histogram(BaseModel):
    edges: list[float]
    counts: list[int]
    density: list[float]
    scale: Literal["linear", "log"]


class Outliers(BaseModel):
    count: int
    fence_low: float
    fence_high: float


class DescVar(BaseModel):
    key: VarKey
    label: str
    unit: str
    kind: Literal["discrete", "continuous"]
    n: int
    mean: float
    median: float
    modes: list[float]
    mode_count: int
    std: float
    variance: float
    min: float
    max: float
    range: float
    cv: float | None
    skewness: float | None
    kurtosis: float | None
    histogram: Histogram
    outliers: Outliers


class Descriptive(BaseModel):
    variables: list[DescVar]


# ---------------------------------------------------------------- 7 posición
class Quartiles(BaseModel):
    q1: float
    q2: float
    q3: float
    iqr: float


class Highlights(BaseModel):
    p90: float
    p95: float
    p99: float


class PercentilePoint(BaseModel):
    p: int
    value: float


class Boxplot(BaseModel):
    min: float
    q1: float
    median: float
    q3: float
    max: float
    whisker_low: float
    whisker_high: float


class RankExample(BaseModel):
    label: str
    value: float
    percentile_rank: float


class PositionVar(BaseModel):
    key: VarKey
    label: str
    unit: str
    quartiles: Quartiles
    deciles: dict[str, float]
    percentiles: list[PercentilePoint]
    highlights: Highlights
    boxplot: Boxplot
    rank_examples: list[RankExample]


class Positions(BaseModel):
    variables: list[PositionVar]


# ---------------------------------------------------------------- 8-10 probabilidad
class EventInfo(BaseModel):
    id: EventId
    name: str
    description: str
    count: int
    p: float


class AxiomCheck(BaseModel):
    name: str
    passed: bool
    detail: str


class Axioms(BaseModel):
    checks: list[AxiomCheck]
    partition_sum: float


class IndependencePair(BaseModel):
    a: EventId
    b: EventId
    p_a: float
    p_b: float
    p_ab: float
    p_a_times_p_b: float
    abs_diff: float
    lift: float | None
    chi2: float | None
    p_value: float | None
    independent: bool
    test: Literal["chi2", "fisher", "degenerate"]
    min_expected: float | None


class FamilyGivenFileType(BaseModel):
    families: list[str]
    file_types: list[str]
    p: list[list[float]]
    file_type_counts: list[int]


class Conditional(BaseModel):
    events: list[EventId]
    matrix: list[list[float | None]]
    family_given_file_type: FamilyGivenFileType


class Probability(BaseModel):
    n: int
    note: str
    events: list[EventInfo]
    axioms: Axioms
    independence: list[IndependencePair]
    conditional: Conditional


# ---------------------------------------------------------------- 11 Bayes
class BayesEvidence(BaseModel):
    field: str
    value: str


class BayesRow(BaseModel):
    hypothesis: str
    prior: float
    likelihood: float
    joint: float
    posterior: float


class BayesStep(BaseModel):
    evidence: BayesEvidence
    marginal: float
    rows: list[BayesRow]


class HypP(BaseModel):
    hypothesis: str
    p: float


class BayesOptions(BaseModel):
    file_type: list[str]
    delivery_method: list[str]
    clamav: list[str]
    size_band: list[str]
    tag: list[str]


class Bayes(BaseModel):
    hypotheses: list[str]
    prior: list[HypP]
    steps: list[BayesStep]
    posterior: list[HypP]
    note: str
    options: BayesOptions


# ---------------------------------------------------------------- 12 v.a.
class RvPmfPoint(BaseModel):
    k: int
    empirical: float
    poisson: float
    neg_binomial: float | None = None


class RvGof(BaseModel):
    chi2: float
    df: int
    p_value: float
    model: str


class RvTail(BaseModel):
    k: int
    p_equal: float
    p_at_least: float


class RvDiscrete(BaseModel):
    id: Literal["X", "Y", "Z"]
    name: str
    description: str
    kind: Literal["discrete"]
    support: str
    mean: float
    variance: float
    pmf: list[RvPmfPoint]
    lambda_: float = Field(alias="lambda")
    dispersion_index: float
    gof: RvGof | None
    tail: list[RvTail]

    model_config = {"populate_by_name": True}


class Lognormal(BaseModel):
    mu: float
    sigma: float


class CurvePoint(BaseModel):
    x: float
    pdf_log: float
    cdf_empirical: float
    cdf_model: float


class Ks(BaseModel):
    statistic: float
    p_value: float


class RvProbability(BaseModel):
    label: str
    p_model: float
    p_empirical: float


class RvContinuous(BaseModel):
    id: Literal["X", "Y", "Z"]
    name: str
    description: str
    kind: Literal["continuous"]
    support: str
    mean: float
    variance: float
    lognormal: Lognormal
    curve: list[CurvePoint]
    histogram: Histogram
    ks: Ks
    probabilities: list[RvProbability]


class ZPmfPoint(BaseModel):
    k: int
    empirical: float


class RvZ(BaseModel):
    id: Literal["X", "Y", "Z"]
    name: str
    description: str
    kind: Literal["discrete"]
    support: str
    mean: float
    variance: float
    pmf: list[ZPmfPoint]


class RandomVariables(BaseModel):
    X: RvDiscrete
    Y: RvContinuous
    Z: RvZ


# ---------------------------------------------------------------- 13 viz
class SizeHistogram(BaseModel):
    edges: list[float]
    counts: list[int]


class FamilyNode(BaseModel):
    id: str
    count: int
    group: str


class FamilyLink(BaseModel):
    source: str
    target: str
    weight: float


class TrendPoint(BaseModel):
    hour: str
    count: int
    moving_avg: float


class Viz(BaseModel):
    families: list[str]
    hours: list[str]
    family_hour_matrix: list[list[int]]
    size_histogram: SizeHistogram
    percentile_curve: list[PercentilePoint]
    family_nodes: list[FamilyNode]
    family_links: list[FamilyLink]
    trend: list[TrendPoint]
