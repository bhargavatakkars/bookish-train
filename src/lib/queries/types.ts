export type DashboardStockRow = {
  companyId: string;
  symbol: string;
  name: string | null;
  currentPrice: string | null;
  marketCap: string | null;
  latestImportAt: Date | null;
  latestImportId: string | null;
  warningCount: number;
};

export type RecentImportRow = {
  importId: string;
  companyId: string;
  symbol: string;
  name: string | null;
  importedAt: Date;
  warningCount: number;
};

export type SystemHealthSummary = {
  totalImports: number;
  importsWithWarnings: number;
  warningsLast7d: number;
  lastImportAt: Date | null;
};

export type StockHeader = {
  companyId: string;
  symbol: string;
  name: string | null;
  latestImportAt: Date | null;
  latestImportId: string | null;
  warningCount: number;
  sectionsAvailable: string[];
  currentPrice: string | null;
  marketCap: string | null;
};

export type MetricPoint = {
  date: string;
  value: number | null;
};

export type StockTimeSeries = {
  sales: MetricPoint[];
  netProfit: MetricPoint[];
  borrowings: MetricPoint[];
  netWorth: MetricPoint[];
  cfo: MetricPoint[];
  cashBalance: MetricPoint[];
  patAndCfo: Array<{ date: string; pat: number | null; cfo: number | null }>;
  quarterlySales: MetricPoint[];
  quarterlyNetProfit: MetricPoint[];
};

export type StockCoverageSummary = {
  availableMetricKeys: string[];
  missingMetricKeys: string[];
  pointsByMetricKey: Record<string, { total: number; nonNull: number }>;
};

export type StockComputedMetric = {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  status: "ok" | "unavailable";
  reasons: Array<{ code: string; message: string }>;
  note?: string;
};

export type StockQualityScorecard = {
  importedDataQualityScore: number;
  confidence: "low" | "medium" | "high";
  reasons: Array<{ code: string; message: string }>;
  dimensions: Array<{
    key: "profitability" | "growth" | "balance_sheet" | "cash_flow" | "data_completeness";
    label: string;
    score10: number;
    badge: "Strong" | "Average" | "Weak";
    explanation: string;
    note?: string;
  }>;
};

export type StockImportedMetricsSnapshot = {
  coverage: StockCoverageSummary;
  metrics: StockComputedMetric[];
  scorecards: StockQualityScorecard;
  overallScore?: number; // 0-100 aggregate score
  coverageCounts?: Array<{ category: string; total: number; nonNull: number }>;
  quarterlySeries?: {
    sales: MetricPoint[];
    netProfit: MetricPoint[];
  };
};
