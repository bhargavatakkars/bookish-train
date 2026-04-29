import "server-only";

import type { MetricPoint } from "@/lib/queries/types";

export type CoverageReasonCode =
  | "NOT_ENOUGH_POINTS"
  | "NOT_ENOUGH_NON_NULL_POINTS"
  | "MISSING_REQUIRED_METRICS";

export type CoverageReason = {
  code: CoverageReasonCode;
  message: string;
  details?: Record<string, unknown>;
};

export type ImportedCoverageSummary = {
  availableMetricKeys: string[];
  missingMetricKeys: string[];
  pointsByMetricKey: Record<string, { total: number; nonNull: number }>;
};

export type ImportedMetricResult = {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  status: "ok" | "unavailable";
  reasons: CoverageReason[];
  note?: string;
};

export type ImportedMetricsSnapshot = {
  coverage: ImportedCoverageSummary;
  metrics: ImportedMetricResult[];
  scorecards: {
    importedDataQualityScore: number;
    confidence: "low" | "medium" | "high";
    reasons: CoverageReason[];
    dimensions: Array<{
      key:
        | "profitability"
        | "growth"
        | "balance_sheet"
        | "cash_flow"
        | "data_completeness";
      label: string;
      score10: number;
      badge: "Strong" | "Average" | "Weak";
      explanation: string;
      note?: string;
    }>;
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sortPointsAsc(points: MetricPoint[]): MetricPoint[] {
  return [...points].sort((a, b) => a.date.localeCompare(b.date));
}

function summarizePoints(points: MetricPoint[]): { total: number; nonNull: number } {
  let nonNull = 0;
  for (const p of points) if (p.value !== null) nonNull++;
  return { total: points.length, nonNull };
}

function lastNonNull(points: MetricPoint[]): { date: string; value: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i]!;
    if (isFiniteNumber(point.value)) return { date: point.date, value: point.value };
  }
  return null;
}

function firstNonNull(points: MetricPoint[]): { date: string; value: number } | null {
  for (const point of points) {
    if (isFiniteNumber(point.value)) return { date: point.date, value: point.value };
  }
  return null;
}

function computeCagrFromSeries(points: MetricPoint[]): ImportedMetricResult {
  const sorted = sortPointsAsc(points);
  const start = firstNonNull(sorted);
  const end = lastNonNull(sorted);
  const reasons: CoverageReason[] = [];

  if (!start || !end) {
    reasons.push({
      code: "NOT_ENOUGH_NON_NULL_POINTS",
      message: "Not enough non-null points to compute CAGR",
    });
    return {
      key: "sales_cagr",
      label: "Sales CAGR",
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  if (start.date === end.date) {
    reasons.push({
      code: "NOT_ENOUGH_POINTS",
      message: "Need at least two distinct periods to compute CAGR",
    });
    return {
      key: "sales_cagr",
      label: "Sales CAGR",
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  if (start.value <= 0 || end.value <= 0) {
    reasons.push({
      code: "NOT_ENOUGH_NON_NULL_POINTS",
      message: "CAGR requires positive start/end values",
      details: { start: start.value, end: end.value },
    });
    return {
      key: "sales_cagr",
      label: "Sales CAGR",
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  const years = Math.max(1, sorted.length - 1);
  const cagr = Math.pow(end.value / start.value, 1 / years) - 1;
  return {
    key: "sales_cagr",
    label: "Sales CAGR",
    value: Number.isFinite(cagr) ? cagr * 100 : null,
    unit: "%",
    status: Number.isFinite(cagr) ? "ok" : "unavailable",
    reasons,
  };
}

function computeCagrWindow(params: {
  key: string;
  label: string;
  points: MetricPoint[];
  years: 3 | 5 | 10;
}): ImportedMetricResult {
  const sorted = sortPointsAsc(params.points).filter((p) => p.value !== null);
  const reasons: CoverageReason[] = [];

  if (sorted.length < params.years + 1) {
    reasons.push({
      code: "NOT_ENOUGH_POINTS",
      message: `Need ${params.years + 1} points to compute ${params.years}Y CAGR`,
      details: { available: sorted.length },
    });
    return {
      key: params.key,
      label: params.label,
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  const end = sorted[sorted.length - 1]!;
  const start = sorted[sorted.length - 1 - params.years]!;
  if (!isFiniteNumber(start.value) || !isFiniteNumber(end.value)) {
    reasons.push({
      code: "NOT_ENOUGH_NON_NULL_POINTS",
      message: "Not enough non-null points to compute CAGR",
    });
    return {
      key: params.key,
      label: params.label,
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  if (start.value <= 0 || end.value <= 0) {
    reasons.push({
      code: "NOT_ENOUGH_NON_NULL_POINTS",
      message: "CAGR requires positive start/end values",
      details: { start: start.value, end: end.value },
    });
    return {
      key: params.key,
      label: params.label,
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  const cagr = Math.pow(end.value / start.value, 1 / params.years) - 1;
  return {
    key: params.key,
    label: params.label,
    value: Number.isFinite(cagr) ? cagr * 100 : null,
    unit: "%",
    status: Number.isFinite(cagr) ? "ok" : "unavailable",
    reasons,
    note: `${start.date} → ${end.date}`,
  };
}

function computeNetMargin(points: MetricPoint[], profitPoints: MetricPoint[]): ImportedMetricResult {
  const salesEnd = lastNonNull(sortPointsAsc(points));
  const profitEnd = lastNonNull(sortPointsAsc(profitPoints));
  const reasons: CoverageReason[] = [];

  if (!salesEnd || !profitEnd) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Missing latest sales or net profit",
    });
    return {
      key: "net_margin",
      label: "Net margin (latest)",
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  if (salesEnd.value === 0) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Latest sales is zero; cannot compute margin",
    });
    return {
      key: "net_margin",
      label: "Net margin (latest)",
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  return {
    key: "net_margin",
    label: "Net margin (latest)",
    value: (profitEnd.value / salesEnd.value) * 100,
    unit: "%",
    status: "ok",
    reasons,
  };
}

function computeCfoToPat(series: Array<{ date: string; pat: number | null; cfo: number | null }>): ImportedMetricResult {
  const reasons: CoverageReason[] = [];
  const last = [...series]
    .reverse()
    .find((p) => isFiniteNumber(p.pat) && isFiniteNumber(p.cfo));

  if (!last || !isFiniteNumber(last.pat) || !isFiniteNumber(last.cfo)) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Missing PAT/CFO pair to compute CFO-to-PAT",
    });
    return {
      key: "cfo_to_pat",
      label: "CFO / PAT (latest)",
      value: null,
      status: "unavailable",
      reasons,
    };
  }

  if (last.pat === 0) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "PAT is zero; cannot compute CFO-to-PAT",
    });
    return {
      key: "cfo_to_pat",
      label: "CFO / PAT (latest)",
      value: null,
      status: "unavailable",
      reasons,
    };
  }

  return {
    key: "cfo_to_pat",
    label: "CFO / PAT (latest)",
    value: last.cfo / last.pat,
    status: "ok",
    reasons,
    note: last.date,
  };
}

function computeDebtToEquity(params: {
  borrowings: MetricPoint[];
  netWorth: MetricPoint[];
}): ImportedMetricResult {
  const debt = lastNonNull(sortPointsAsc(params.borrowings));
  const equity = lastNonNull(sortPointsAsc(params.netWorth));
  const reasons: CoverageReason[] = [];

  if (!debt || !equity) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Missing borrowings or net worth to compute debt/equity",
    });
    return {
      key: "debt_to_equity",
      label: "Debt / Equity (latest)",
      value: null,
      status: "unavailable",
      reasons,
    };
  }
  if (equity.value === 0) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Net worth is zero; cannot compute debt/equity",
    });
    return {
      key: "debt_to_equity",
      label: "Debt / Equity (latest)",
      value: null,
      status: "unavailable",
      reasons,
    };
  }

  return {
    key: "debt_to_equity",
    label: "Debt / Equity (latest)",
    value: debt.value / equity.value,
    status: "ok",
    reasons,
    note: equity.date,
  };
}

function computeInterestCoverage(params: {
  ebit: MetricPoint[];
  interest: MetricPoint[];
}): ImportedMetricResult {
  const ebit = lastNonNull(sortPointsAsc(params.ebit));
  const interest = lastNonNull(sortPointsAsc(params.interest));
  const reasons: CoverageReason[] = [];

  if (!ebit || !interest) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Missing EBIT or interest to compute interest coverage",
    });
    return {
      key: "interest_coverage",
      label: "Interest coverage (latest)",
      value: null,
      status: "unavailable",
      reasons,
    };
  }
  if (interest.value === 0) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Interest is zero; cannot compute interest coverage",
    });
    return {
      key: "interest_coverage",
      label: "Interest coverage (latest)",
      value: null,
      status: "unavailable",
      reasons,
    };
  }

  return {
    key: "interest_coverage",
    label: "Interest coverage (latest)",
    value: ebit.value / interest.value,
    status: "ok",
    reasons,
    note: ebit.date,
  };
}

function computeDividendPayoutProxy(params: {
  dividends: MetricPoint[];
  netProfit: MetricPoint[];
}): ImportedMetricResult {
  const dividends = lastNonNull(sortPointsAsc(params.dividends));
  const profit = lastNonNull(sortPointsAsc(params.netProfit));
  const reasons: CoverageReason[] = [];

  if (!dividends || !profit) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Missing dividends or net profit for dividend payout proxy",
    });
    return {
      key: "dividend_payout_proxy",
      label: "Dividend payout proxy (latest)",
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }
  if (profit.value === 0) {
    reasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Net profit is zero; cannot compute dividend payout proxy",
    });
    return {
      key: "dividend_payout_proxy",
      label: "Dividend payout proxy (latest)",
      value: null,
      unit: "%",
      status: "unavailable",
      reasons,
    };
  }

  return {
    key: "dividend_payout_proxy",
    label: "Dividend payout proxy (latest)",
    value: (dividends.value / profit.value) * 100,
    unit: "%",
    status: "ok",
    reasons,
    note: profit.date,
  };
}

function computeCoverageCounts(params: {
  seriesByMetricKey: Record<string, MetricPoint[]>;
}): ImportedMetricResult[] {
  const keys = Object.keys(params.seriesByMetricKey).sort();
  return keys.map((key) => {
    const points = params.seriesByMetricKey[key] ?? [];
    const nonNull = points.filter((p) => p.value !== null).length;
    const total = points.length;
    const status: ImportedMetricResult["status"] = total > 0 ? "ok" : "unavailable";
    const reasons: CoverageReason[] =
      total > 0
        ? []
        : [
            {
              code: "NOT_ENOUGH_POINTS",
              message: "No points available",
            },
          ];
    return {
      key: `coverage_${key}`,
      label: `Coverage: ${key}`,
      value: total,
      status,
      reasons,
      note: `${nonNull}/${total} non-null`,
    };
  });
}

export function computeImportedMetrics(params: {
  availableMetricKeys: string[];
  seriesByMetricKey: Record<string, MetricPoint[]>;
  patAndCfo: Array<{ date: string; pat: number | null; cfo: number | null }>;
}): ImportedMetricsSnapshot {
  const requiredMetricKeys = [
    "sales",
    "net_profit",
    "borrowings",
    "cash_from_operating_activity",
    "cash_equivalents",
    "net_worth",
    "ebit",
    "interest",
    "dividends",
  ];

  const available = new Set(params.availableMetricKeys);
  const missingMetricKeys = requiredMetricKeys.filter((k) => !available.has(k));
  const pointsByMetricKey: ImportedCoverageSummary["pointsByMetricKey"] = {};
  for (const key of requiredMetricKeys) {
    pointsByMetricKey[key] = summarizePoints(params.seriesByMetricKey[key] ?? []);
  }

  const coverage: ImportedCoverageSummary = {
    availableMetricKeys: [...params.availableMetricKeys].sort(),
    missingMetricKeys,
    pointsByMetricKey,
  };

  const metrics: ImportedMetricResult[] = [
    computeCagrWindow({
      key: "revenue_cagr_3y",
      label: "Revenue CAGR (3Y)",
      points: params.seriesByMetricKey.sales ?? [],
      years: 3,
    }),
    computeCagrWindow({
      key: "revenue_cagr_5y",
      label: "Revenue CAGR (5Y)",
      points: params.seriesByMetricKey.sales ?? [],
      years: 5,
    }),
    computeCagrWindow({
      key: "revenue_cagr_10y",
      label: "Revenue CAGR (10Y)",
      points: params.seriesByMetricKey.sales ?? [],
      years: 10,
    }),
    computeCagrWindow({
      key: "net_profit_cagr_3y",
      label: "Net profit CAGR (3Y)",
      points: params.seriesByMetricKey.net_profit ?? [],
      years: 3,
    }),
    computeCagrWindow({
      key: "net_profit_cagr_5y",
      label: "Net profit CAGR (5Y)",
      points: params.seriesByMetricKey.net_profit ?? [],
      years: 5,
    }),
    computeCagrWindow({
      key: "net_profit_cagr_10y",
      label: "Net profit CAGR (10Y)",
      points: params.seriesByMetricKey.net_profit ?? [],
      years: 10,
    }),
    computeNetMargin(
      params.seriesByMetricKey.sales ?? [],
      params.seriesByMetricKey.net_profit ?? [],
    ),
    computeDebtToEquity({
      borrowings: params.seriesByMetricKey.borrowings ?? [],
      netWorth: params.seriesByMetricKey.net_worth ?? [],
    }),
    computeInterestCoverage({
      ebit: params.seriesByMetricKey.ebit ?? [],
      interest: params.seriesByMetricKey.interest ?? [],
    }),
    computeCfoToPat(params.patAndCfo),
    computeDividendPayoutProxy({
      dividends: params.seriesByMetricKey.dividends ?? [],
      netProfit: params.seriesByMetricKey.net_profit ?? [],
    }),
    ...computeCoverageCounts({ seriesByMetricKey: params.seriesByMetricKey }),
  ];

  const scoreReasons: CoverageReason[] = [];
  if (missingMetricKeys.length > 0) {
    scoreReasons.push({
      code: "MISSING_REQUIRED_METRICS",
      message: "Some required metrics are missing",
      details: { missingMetricKeys },
    });
  }

  const nonNullPoints = Object.values(pointsByMetricKey).reduce(
    (sum, v) => sum + v.nonNull,
    0,
  );
  const totalPoints = Object.values(pointsByMetricKey).reduce(
    (sum, v) => sum + v.total,
    0,
  );

  const completeness = totalPoints === 0 ? 0 : nonNullPoints / totalPoints;
  const penalty = Math.min(0.5, missingMetricKeys.length * 0.1);
  const importedDataQualityScore = Math.max(0, Math.round((completeness - penalty) * 100));
  const confidence =
    importedDataQualityScore >= 70 ? "high" : importedDataQualityScore >= 40 ? "medium" : "low";

  if (totalPoints === 0) {
    scoreReasons.push({
      code: "NOT_ENOUGH_POINTS",
      message: "No imported time-series points available",
    });
  }

  const getMetric = (key: string) => metrics.find((m) => m.key === key) ?? null;
  const badgeFor = (score10: number): "Strong" | "Average" | "Weak" =>
    score10 >= 7 ? "Strong" : score10 >= 4 ? "Average" : "Weak";
  const scoreFromPercent = (value: number | null) => {
    if (value === null) return 0;
    if (value >= 15) return 10;
    if (value >= 8) return 7;
    if (value >= 3) return 5;
    return 2;
  };
  const scoreFromCagr = (value: number | null) => {
    if (value === null) return 0;
    if (value >= 15) return 10;
    if (value >= 10) return 8;
    if (value >= 5) return 6;
    if (value >= 0) return 4;
    return 1;
  };
  const scoreFromRatio = (value: number | null, goodAbove: number) => {
    if (value === null) return 0;
    if (value >= goodAbove) return 10;
    if (value >= goodAbove * 0.7) return 7;
    if (value >= goodAbove * 0.4) return 5;
    return 2;
  };
  const scoreFromDebtEquity = (value: number | null) => {
    if (value === null) return 0;
    if (value <= 0.5) return 10;
    if (value <= 1) return 7;
    if (value <= 2) return 4;
    return 1;
  };

  const profitabilityScore = scoreFromPercent(getMetric("net_margin")?.value ?? null);
  const growthScore = scoreFromCagr(getMetric("revenue_cagr_5y")?.value ?? null);
  const balanceSheetScore = scoreFromDebtEquity(getMetric("debt_to_equity")?.value ?? null);
  const cashFlowScore = scoreFromRatio(getMetric("cfo_to_pat")?.value ?? null, 1);
  const dataScore = Math.round(importedDataQualityScore / 10);

  const dimensions: ImportedMetricsSnapshot["scorecards"]["dimensions"] = [
    {
      key: "profitability",
      label: "Profitability",
      score10: profitabilityScore,
      badge: badgeFor(profitabilityScore),
      explanation: "Latest net margin derived from imported sales & PAT.",
      note: getMetric("net_margin")?.note,
    },
    {
      key: "growth",
      label: "Growth",
      score10: growthScore,
      badge: badgeFor(growthScore),
      explanation: "Revenue CAGR from imported annual sales (5Y when available).",
      note: getMetric("revenue_cagr_5y")?.note,
    },
    {
      key: "balance_sheet",
      label: "Balance sheet",
      score10: balanceSheetScore,
      badge: badgeFor(balanceSheetScore),
      explanation: "Debt/equity proxy from borrowings and net worth.",
      note: getMetric("debt_to_equity")?.note,
    },
    {
      key: "cash_flow",
      label: "Cash flow",
      score10: cashFlowScore,
      badge: badgeFor(cashFlowScore),
      explanation: "CFO/PAT ratio indicates cash conversion quality.",
      note: getMetric("cfo_to_pat")?.note,
    },
    {
      key: "data_completeness",
      label: "Data completeness",
      score10: dataScore,
      badge: badgeFor(dataScore),
      explanation: "Coverage across required imported metrics.",
      note: `${nonNullPoints}/${totalPoints} points`,
    },
  ];

  return {
    coverage,
    metrics,
    scorecards: {
      importedDataQualityScore,
      confidence,
      reasons: scoreReasons,
      dimensions,
    },
  };
}
