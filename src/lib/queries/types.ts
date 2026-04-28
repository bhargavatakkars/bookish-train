export type DashboardStockRow = {
  companyId: string;
  symbol: string;
  name: string | null;
  latestImportAt: Date | null;
  latestImportId: string | null;
  warningCount: number;
};

export type StockHeader = {
  companyId: string;
  symbol: string;
  name: string | null;
  latestImportAt: Date | null;
  latestImportId: string | null;
  warningCount: number;
  sectionsAvailable: string[];
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

