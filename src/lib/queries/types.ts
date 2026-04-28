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
  cfo: MetricPoint[];
  cashBalance: MetricPoint[];
  patAndCfo: Array<{ date: string; pat: number | null; cfo: number | null }>;
};
