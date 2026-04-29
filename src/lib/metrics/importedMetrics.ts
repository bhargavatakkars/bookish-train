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
  reasons: CoverageReason[];
};

export type ImportedMetricsSnapshot = {
  coverage: ImportedCoverageSummary;
  metrics: ImportedMetricResult[];
  scorecards: {
    importedDataQualityScore: number;
    confidence: "low" | "medium" | "high";
    reasons: CoverageReason[];
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
    reasons,
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
      reasons,
    };
  }

  return {
    key: "net_margin",
    label: "Net margin (latest)",
    value: (profitEnd.value / salesEnd.value) * 100,
    unit: "%",
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
      reasons,
    };
  }

  return {
    key: "cfo_to_pat",
    label: "CFO / PAT (latest)",
    value: last.cfo / last.pat,
    reasons,
  };
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
    computeCagrFromSeries(params.seriesByMetricKey.sales ?? []),
    computeNetMargin(
      params.seriesByMetricKey.sales ?? [],
      params.seriesByMetricKey.net_profit ?? [],
    ),
    computeCfoToPat(params.patAndCfo),
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

  return {
    coverage,
    metrics,
    scorecards: {
      importedDataQualityScore,
      confidence,
      reasons: scoreReasons,
    },
  };
}

