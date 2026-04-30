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
  overallScore?: number; // 0-100 aggregate weighted score
  // Simple per‑category coverage counts (optional, used by UI if needed)
  coverageCounts?: Array<{ category: string; total: number; nonNull: number }>;
  // Quarterly series for UI consumption (bar chart, etc.)
  quarterlySeries?: {
    sales: MetricPoint[];
    netProfit: MetricPoint[];
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


// computeCagrFromSeries was previously used for a generic CAGR calculation but
// the Milestone 2 implementation now uses computeCagrWindow for specific windows.
// The function is retained for reference but removed to avoid unused‑code warnings.

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

  // ---------------------------------------------------------------------------
  // Dividend payout proxy helper
  // ---------------------------------------------------------------------------
  /**
   * Approximate dividend payout ratio using the latest dividend amount and the
   * latest net profit. The proxy is defined as dividends / net profit. If either
   * value is missing or net profit is zero the metric is marked unavailable.
   */
  function computeDividendPayoutProxy(params: {
    dividends: MetricPoint[];
    netProfit: MetricPoint[];
  }): ImportedMetricResult {
    const lastDiv = lastNonNull(sortPointsAsc(params.dividends));
    const lastProfit = lastNonNull(sortPointsAsc(params.netProfit));
    const reasons: CoverageReason[] = [];

    if (!lastDiv || !lastProfit) {
      reasons.push({
        code: "MISSING_REQUIRED_METRICS",
        message: "Missing dividend or net profit data for dividend payout proxy",
      });
      return {
        key: "dividend_payout_proxy",
        label: "Dividend payout proxy (latest)",
        value: null,
        status: "unavailable",
        reasons,
      };
    }

    if (lastProfit.value === 0) {
      reasons.push({
        code: "MISSING_REQUIRED_METRICS",
        message: "Net profit is zero – cannot compute dividend payout proxy",
      });
      return {
        key: "dividend_payout_proxy",
        label: "Dividend payout proxy (latest)",
        value: null,
        status: "unavailable",
        reasons,
      };
    }

    return {
      key: "dividend_payout_proxy",
      label: "Dividend payout proxy (latest)",
      value: lastDiv.value / lastProfit.value,
      status: "ok",
      reasons,
      note: lastDiv.date,
    };
  }

  // ---------------------------------------------------------------------------
  // Net‑worth metric helper (latest value)
  // ---------------------------------------------------------------------------
  function computeNetWorthMetric(params: { netWorth: MetricPoint[] }): ImportedMetricResult {
    const last = lastNonNull(sortPointsAsc(params.netWorth));
    const reasons: CoverageReason[] = [];
    if (!last) {
      reasons.push({
        code: "MISSING_REQUIRED_METRICS",
        message: "Missing net‑worth data",
      });
      return {
        key: "net_worth",
        label: "Net worth (latest)",
        value: null,
        status: "unavailable",
        reasons,
      };
    }
    return {
      key: "net_worth",
      label: "Net worth (latest)",
      value: last.value,
      status: "ok",
      reasons,
      note: last.date,
    };
  }

  // ---------------------------------------------------------------------------
  // Quarterly growth helpers (QoQ and YoY)
  // ---------------------------------------------------------------------------
  function computeQoQGrowth(points: MetricPoint[], metricLabel: string): ImportedMetricResult {
    const sorted = sortPointsAsc(points).filter((p) => p.value !== null) as Array<{ date: string; value: number }>;
    const reasons: CoverageReason[] = [];

    if (sorted.length < 2) {
      reasons.push({
        code: "NOT_ENOUGH_POINTS",
        message: "Need at least 2 quarters to compute QoQ growth",
      });
      return {
        key: `${metricLabel}_qoq`,
        label: `${metricLabel === "sales" ? "Revenue" : "Net Profit"} QoQ growth (latest)`,
        value: null,
        unit: "%",
        status: "unavailable",
        reasons,
      };
    }

    const current = sorted[sorted.length - 1]!;
    const previous = sorted[sorted.length - 2]!;

    if (previous.value === 0) {
      reasons.push({
        code: "NOT_ENOUGH_NON_NULL_POINTS",
        message: "Previous quarter value is zero; cannot compute QoQ",
      });
      return {
        key: `${metricLabel}_qoq`,
        label: `${metricLabel === "sales" ? "Revenue" : "Net Profit"} QoQ growth (latest)`,
        value: null,
        unit: "%",
        status: "unavailable",
        reasons,
      };
    }

    const qoq = ((current.value - previous.value) / Math.abs(previous.value)) * 100;
    return {
      key: `${metricLabel}_qoq`,
      label: `${metricLabel === "sales" ? "Revenue" : "Net Profit"} QoQ growth (latest)`,
      value: Number.isFinite(qoq) ? qoq : null,
      unit: "%",
      status: Number.isFinite(qoq) ? "ok" : "unavailable",
      reasons,
      note: `${previous.date} → ${current.date}`,
    };
  }

  function computeYoYGrowth(points: MetricPoint[], metricLabel: string): ImportedMetricResult {
    const sorted = sortPointsAsc(points).filter((p) => p.value !== null) as Array<{ date: string; value: number }>;
    const reasons: CoverageReason[] = [];

    if (sorted.length < 5) {
      reasons.push({
        code: "NOT_ENOUGH_POINTS",
        message: "Need at least 5 quarters (to find same quarter last year) to compute YoY growth",
      });
      return {
        key: `${metricLabel}_yoy`,
        label: `${metricLabel === "sales" ? "Revenue" : "Net Profit"} YoY growth (latest)`,
        value: null,
        unit: "%",
        status: "unavailable",
        reasons,
      };
    }

    const current = sorted[sorted.length - 1]!;
    // Find the same quarter from the previous year (4 quarters ago)
    const previous = sorted[sorted.length - 5]!;

    if (previous.value === 0) {
      reasons.push({
        code: "NOT_ENOUGH_NON_NULL_POINTS",
        message: "Same quarter last year value is zero; cannot compute YoY",
      });
      return {
        key: `${metricLabel}_yoy`,
        label: `${metricLabel === "sales" ? "Revenue" : "Net Profit"} YoY growth (latest)`,
        value: null,
        unit: "%",
        status: "unavailable",
        reasons,
      };
    }

    const yoy = ((current.value - previous.value) / Math.abs(previous.value)) * 100;
    return {
      key: `${metricLabel}_yoy`,
      label: `${metricLabel === "sales" ? "Revenue" : "Net Profit"} YoY growth (latest)`,
      value: Number.isFinite(yoy) ? yoy : null,
      unit: "%",
      status: Number.isFinite(yoy) ? "ok" : "unavailable",
      reasons,
      note: `${previous.date} → ${current.date}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Snapshot builder – orchestrates all metric calculations
  // ---------------------------------------------------------------------------
  export function buildImportedMetricsSnapshot(params: {
    series: {
      sales: MetricPoint[];
      netProfit: MetricPoint[];
      borrowings: MetricPoint[];
      netWorth: MetricPoint[];
      cfo: MetricPoint[];
      cashBalance: MetricPoint[];
      ebit: MetricPoint[];
      interest: MetricPoint[];
      dividends: MetricPoint[];
      quarterlySales?: MetricPoint[];
      quarterlyNetProfit?: MetricPoint[];
    };
    coverage: ImportedCoverageSummary;
  }): ImportedMetricsSnapshot {
    const { series, coverage } = params;

    // Compute individual metrics
    const metrics: ImportedMetricResult[] = [];

    // Revenue CAGR windows
    metrics.push(
      computeCagrWindow({
        key: "revenue_cagr_3y",
        label: "Revenue CAGR (3Y)",
        points: series.sales,
        years: 3 as const,
      }),
      computeCagrWindow({
        key: "revenue_cagr_5y",
        label: "Revenue CAGR (5Y)",
        points: series.sales,
        years: 5 as const,
      }),
      computeCagrWindow({
        key: "revenue_cagr_10y",
        label: "Revenue CAGR (10Y)",
        points: series.sales,
        years: 10 as const,
      }),
    );

    // Net profit CAGR windows
    metrics.push(
      computeCagrWindow({
        key: "net_profit_cagr_3y",
        label: "Net profit CAGR (3Y)",
        points: series.netProfit,
        years: 3 as const,
      }),
      computeCagrWindow({
        key: "net_profit_cagr_5y",
        label: "Net profit CAGR (5Y)",
        points: series.netProfit,
        years: 5 as const,
      }),
      computeCagrWindow({
        key: "net_profit_cagr_10y",
        label: "Net profit CAGR (10Y)",
        points: series.netProfit,
        years: 10 as const,
      }),
    );

    // Latest net margin
    metrics.push(computeNetMargin(series.sales, series.netProfit));

    // Debt / Equity
    metrics.push(computeDebtToEquity({ borrowings: series.borrowings, netWorth: series.netWorth }));

    // Interest coverage
    metrics.push(computeInterestCoverage({ ebit: series.ebit, interest: series.interest }));

    // CFO / PAT
    const patAndCfo = series.netProfit.map((p, i) => ({
      date: p.date,
      pat: p.value,
      cfo: series.cfo[i]?.value ?? null,
    }));
    metrics.push(computeCfoToPat(patAndCfo));

    // Dividend payout proxy
    metrics.push(computeDividendPayoutProxy({ dividends: series.dividends, netProfit: series.netProfit }));

    // Net worth metric
    metrics.push(computeNetWorthMetric({ netWorth: series.netWorth }));

    // Quarterly growth metrics (QoQ and YoY for Revenue and PAT)
    if (series.quarterlySales && series.quarterlySales.length > 0) {
      metrics.push(computeQoQGrowth(series.quarterlySales, "sales"));
      metrics.push(computeYoYGrowth(series.quarterlySales, "sales"));
    }
    if (series.quarterlyNetProfit && series.quarterlyNetProfit.length > 0) {
      metrics.push(computeQoQGrowth(series.quarterlyNetProfit, "net_profit"));
      metrics.push(computeYoYGrowth(series.quarterlyNetProfit, "net_profit"));
    }

    // -----------------------------------------------------------------------
    // Simple data‑completeness scoring per category
    // -----------------------------------------------------------------------
    // The original keyToGroup mapping was unused after refactoring. It has been
    // removed to eliminate the unused‑variable warning.
    const groupMetrics: Record<string, ImportedMetricResult[]> = {
      profitability: [],
      growth: [],
      balance_sheet: [],
      cash_flow: [],
      data_completeness: [],
    };

    // Populate groups for scoring (profitability, balance_sheet, cash_flow)
    for (const m of metrics) {
      if (m.key.includes("cagr")) {
        groupMetrics.growth.push(m);
      } else if (m.key === "net_margin") {
        groupMetrics.profitability.push(m);
      } else if (m.key === "debt_to_equity" || m.key === "interest_coverage") {
        groupMetrics.balance_sheet.push(m);
      } else if (m.key === "cfo_to_pat" || m.key === "dividend_payout_proxy") {
        groupMetrics.cash_flow.push(m);
      } else if (m.key === "net_worth") {
        groupMetrics.balance_sheet.push(m);
      }
    }

    // Helper to compute a 0‑10 score based on proportion of ok metrics
    const computeScore = (arr: ImportedMetricResult[]): { score10: number; badge: "Strong" | "Average" | "Weak" } => {
      if (arr.length === 0) return { score10: 0, badge: "Weak" as const };
      const okCount = arr.filter((m) => m.status === "ok").length;
      const ratio = okCount / arr.length;
      const score10 = Math.round(ratio * 10);
      const badge = ratio >= 0.8 ? "Strong" : ratio >= 0.5 ? "Average" : "Weak";
      return { score10, badge };
    };

    const dimensions = [
      {
        key: "profitability" as const,
        label: "Profitability",
        ...computeScore(groupMetrics.profitability),
        explanation: "Based on net margin and related profitability metrics.",
      },
      {
        key: "growth" as const,
        label: "Growth",
        ...computeScore(groupMetrics.growth),
        explanation: "Based on revenue and net‑profit CAGR metrics.",
      },
      {
        key: "balance_sheet" as const,
        label: "Balance Sheet",
        ...computeScore(groupMetrics.balance_sheet),
        explanation: "Based on debt/equity, interest coverage and net‑worth.",
      },
      {
        key: "cash_flow" as const,
        label: "Cash Flow",
        ...computeScore(groupMetrics.cash_flow),
        explanation: "Based on CFO/PAT and dividend payout proxy.",
      },
      {
        key: "data_completeness" as const,
        label: "Data Completeness",
        score10: 0,
        badge: "Weak" as const,
        explanation: "Counts of available points per data category.",
      },
    ];

    // -----------------------------------------------------------------------
    // Coverage counts per high‑level category (annual, quarterly, balance‑sheet, cash‑flow, price)
    // -----------------------------------------------------------------------
    const categoryMap: Record<string, string[]> = {
      annual: ["sales", "net_profit", "borrowings", "net_worth", "ebit", "interest", "dividends"],
      "balance-sheet": ["borrowings", "net_worth", "cash_equivalents", "interest"],
      "cash-flow": ["cfo", "cash_from_operating_activity", "dividends"],
      price: ["price"],
    };

    // Compute quarterly coverage from the series directly
    const quarterlyTotal = (series.quarterlySales?.length ?? 0) + (series.quarterlyNetProfit?.length ?? 0);
    const quarterlyNonNull = (series.quarterlySales?.filter((p) => p.value !== null).length ?? 0) +
      (series.quarterlyNetProfit?.filter((p) => p.value !== null).length ?? 0);

    const coverageCounts = Object.entries(categoryMap).map(([cat, keys]) => {
      let total = 0;
      let nonNull = 0;
      for (const k of keys) {
        const entry = coverage.pointsByMetricKey[k];
        if (entry) {
          total += entry.total;
          nonNull += entry.nonNull;
        }
      }
      return { category: cat, total, nonNull };
    });

    // Add quarterly coverage counts
    coverageCounts.push({ category: "quarterly", total: quarterlyTotal, nonNull: quarterlyNonNull });

    // Compute overall weighted score (0-100)
    // Weights: Profitability 25%, Growth 25%, Balance Sheet 20%, Cash Flow 20%, Data Completeness 10%
    const weights = {
      profitability: 0.25,
      growth: 0.25,
      balance_sheet: 0.20,
      cash_flow: 0.20,
      data_completeness: 0.10,
    } as const;

    let weightedSum = 0;
    let weightUsed = 0;
    for (const dim of dimensions) {
      const w = weights[dim.key as keyof typeof weights] ?? 0;
      if (w > 0 && dim.score10 !== undefined) {
        weightedSum += (dim.score10 / 10) * w;
        weightUsed += w;
      }
    }
    const overallScore = weightUsed > 0 ? Math.round((weightedSum / weightUsed) * 100) : 0;

    // Attach simple counts to the dimensions array for UI (optional)
    // Here we just store them in a dedicated field on the snapshot (not used elsewhere yet)
    const snapshot: ImportedMetricsSnapshot = {
      coverage,
      metrics,
      scorecards: {
        importedDataQualityScore: 0, // placeholder – could be aggregated later
        confidence: "medium",
        reasons: [],
        dimensions,
      },
      overallScore,
      // Include quarterly series for UI consumption (bar chart, etc.)
      quarterlySeries: series.quarterlySales || series.quarterlyNetProfit
        ? {
            sales: series.quarterlySales ?? [],
            netProfit: series.quarterlyNetProfit ?? [],
          }
        : undefined,
    };

    // Attach the optional coverage counts (typed in ImportedMetricsSnapshot)
    snapshot.coverageCounts = coverageCounts;
    return snapshot;
  }
