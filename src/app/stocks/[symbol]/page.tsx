import Link from "next/link";
import { notFound } from "next/navigation";

import { SummaryCard } from "@/components/SummaryCard";
import { StockTrendChart } from "@/components/StockTrendChart";
import {
  getAnnualPriceSeries,
  getImportedMetricsSnapshot,
  getParserWarnings,
  getStockHeaderBySymbol,
  getStockTimeSeries,
} from "@/lib/queries/stock";
import { buildOwnershipGovernanceSummary, calculateRiskSignals } from '@/lib/enrichment/ownershipGovernancePresenter';
import type { OwnershipGovernanceSummary, RiskSignal } from '@/lib/connectors/types';

import type { StockComputedMetric } from "@/lib/queries/types";

function formatValue(value: number | null): string {
  if (value === null) return "Not available from import";
  return value.toLocaleString("en-IN");
}

function formatTextValue(value: string | null): string {
  return value ?? "Not available from import";
}

function formatPercent(value: number | null): string {
  if (value === null) return "Not available from import";
  return `${value.toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  if (value === null) return "Not available from import";
  return value.toFixed(2);
}

function formatMetricValue(value: number | null, key: string): string {
  if (value === null) return "—";
  if (key.includes("cagr") || key.includes("margin") || key.includes("payout")) {
    return formatPercent(value);
  }
  if (
    key.includes("debt_to_equity") ||
    key.includes("interest_coverage") ||
    key.includes("cfo_to_pat")
  ) {
    return formatRatio(value);
  }
  return formatRatio(value);
}

function lastNonNull(series: Array<{ value: number | null }>): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const value = series[i]!.value;
    if (value !== null) return value;
  }
  return null;
}

type MetricGroupKey = "profitability" | "growth" | "balance_sheet" | "cash_flow" | "data_completeness";

function groupMetricsByCategory(
  metrics: StockComputedMetric[],
): Record<MetricGroupKey, StockComputedMetric[]> {
  const groups: Record<MetricGroupKey, StockComputedMetric[]> = {
    profitability: [],
    growth: [],
    balance_sheet: [],
    cash_flow: [],
    data_completeness: [],
  };

  for (const m of metrics) {
    if (m.key === "net_margin") {
      groups.profitability.push(m);
    } else if (
      m.key.includes("revenue_cagr") ||
      m.key.includes("net_profit_cagr")
    ) {
      groups.growth.push(m);
    } else if (
      m.key === "debt_to_equity" ||
      m.key === "interest_coverage"
    ) {
      groups.balance_sheet.push(m);
    } else if (m.key === "cfo_to_pat" || m.key === "dividend_payout_proxy") {
      groups.cash_flow.push(m);
    } else if (m.key.startsWith("coverage_")) {
      groups.data_completeness.push(m);
    }
  }

  return groups;
}

type CoverageGroupKey = "profitability" | "balance_sheet" | "cash_flow" | "valuation" | "ownership_governance";

function groupCoverageByCategory(
  coverage: Record<string, { total: number; nonNull: number }>,
  missing: string[],
): Record<CoverageGroupKey, Array<{ key: string; total: number; nonNull: number; isMissing: boolean }>> {
  const groups: Record<CoverageGroupKey, Array<{ key: string; total: number; nonNull: number; isMissing: boolean }>> = {
    profitability: [],
    balance_sheet: [],
    cash_flow: [],
    valuation: [],
    ownership_governance: [],
  };

  const keyToGroup: Record<string, CoverageGroupKey> = {
    sales: "profitability",
    net_profit: "profitability",
    borrowings: "balance_sheet",
    net_worth: "balance_sheet",
    cash_equivalents: "balance_sheet",
    cash_from_operating_activity: "cash_flow",
    ebit: "profitability",
    interest: "balance_sheet",
    dividends: "cash_flow",
  };

  for (const [key, counts] of Object.entries(coverage)) {
    const groupKey = keyToGroup[key] || "valuation";
    groups[groupKey].push({
      key,
      total: counts.total,
      nonNull: counts.nonNull,
      isMissing: missing.includes(key),
    });
  }

  return groups;
}

interface MetricCardProps {
  metric: StockComputedMetric;
}

function MetricCard({ metric }: MetricCardProps) {
  return (
    <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {metric.label}
          </div>
          {metric.note && (
            <div className="mt-1 text-xs text-zinc-500">{metric.note}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {formatMetricValue(metric.value, metric.key)}
          </div>
          {metric.value === null && metric.reasons.length > 0 && (
            <div className="mt-1 text-xs text-zinc-500">
              {metric.reasons[0]!.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricGroupSectionProps {
  title: string;
  metrics: StockComputedMetric[];
  dimensions?: Array<{ key: string; label: string; score10: number; badge: string; explanation: string; note?: string }>;
}

function MetricGroupSection({ title, metrics, dimensions }: MetricGroupSectionProps) {
  if (metrics.length === 0 && (!dimensions || dimensions.length === 0)) {
    return null;
  }

  const dimension = dimensions?.find((d) => d.label === title);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {dimension && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Score
              </div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {dimension.score10}/10
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                dimension.badge === "Strong"
                  ? "bg-emerald-100 text-emerald-800"
                  : dimension.badge === "Average"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
              }`}
            >
              {dimension.badge}
            </span>
          </div>
        )}
      </div>
      {dimension && (
        <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          {dimension.explanation}
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {metrics.map((m) => (
          <MetricCard key={m.key} metric={m} />
        ))}
      </div>
    </div>
  );
}

interface CoverageItem {
  key: string;
  total: number;
  nonNull: number;
  isMissing: boolean;
}

interface CoverageGroupSectionProps {
  title: string;
  items: CoverageItem[];
}

function CoverageGroupSection({ title, items }: CoverageGroupSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <div className="mt-3 grid gap-2 text-sm">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
              {item.key}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  item.isMissing
                    ? "bg-rose-100 text-rose-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {item.isMissing ? "missing" : "present"}
              </span>
              <span className="text-xs text-zinc-500">
                {item.nonNull}/{item.total}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function StockPage(props: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await props.params;
  const header = await getStockHeaderBySymbol(symbol);
  if (!header) notFound();

  const [warnings, series, annualPrices] = await Promise.all([
    header.latestImportId ? getParserWarnings(header.latestImportId) : [],
    getStockTimeSeries(header.companyId),
    header.latestImportId ? getAnnualPriceSeries(header.latestImportId) : [],
  ]);

  const importedSnapshot = await getImportedMetricsSnapshot({ header, series });

  const latestSales = lastNonNull(series.sales);
  const latestNetProfit = lastNonNull(series.netProfit);
  const latestBorrowings = lastNonNull(series.borrowings);
  const latestCfo = lastNonNull(series.cfo);
  const latestCash = lastNonNull(series.cashBalance);

  const readyForScoring =
    series.sales.filter((p) => p.value !== null).length >= 3 &&
    series.netProfit.filter((p) => p.value !== null).length >= 3 &&
    series.borrowings.filter((p) => p.value !== null).length >= 2 &&
    series.cfo.filter((p) => p.value !== null).length >= 2;

  const metricsByGroup = groupMetricsByCategory(importedSnapshot.metrics);
  const coverageByGroup = groupCoverageByCategory(
    importedSnapshot.coverage.pointsByMetricKey,
    importedSnapshot.coverage.missingMetricKeys,
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="text-sm text-zinc-500">Stock</div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {header.name ?? header.symbol}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-mono text-xs">{header.symbol}</span>
            <span>
              Latest import:{" "}
              {header.latestImportAt ? header.latestImportAt.toISOString() : "—"}
            </span>
            <span>Warnings: {header.warningCount}</span>
            {importedSnapshot.overallScore !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  importedSnapshot.overallScore >= 70
                    ? "bg-emerald-100 text-emerald-800"
                    : importedSnapshot.overallScore >= 40
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
                title={`Overall Score: ${importedSnapshot.overallScore}/100\n` +
                  `Profitability: ${importedSnapshot.scorecards.dimensions.find(d => d.key === "profitability")?.score10 ?? 0}/10\n` +
                  `Growth: ${importedSnapshot.scorecards.dimensions.find(d => d.key === "growth")?.score10 ?? 0}/10\n` +
                  `Balance Sheet: ${importedSnapshot.scorecards.dimensions.find(d => d.key === "balance_sheet")?.score10 ?? 0}/10\n` +
                  `Cash Flow: ${importedSnapshot.scorecards.dimensions.find(d => d.key === "cash_flow")?.score10 ?? 0}/10\n` +
                  `Data Completeness: ${importedSnapshot.scorecards.dimensions.find(d => d.key === "data_completeness")?.score10 ?? 0}/10`}
              >
                Score: {importedSnapshot.overallScore}/100
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                readyForScoring
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {readyForScoring ? "Ready for scoring" : "Not ready"}
            </span>
          </div>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
        >
          Back
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Current Price" value={formatTextValue(header.currentPrice)} />
        <SummaryCard title="Market Cap" value={formatTextValue(header.marketCap)} />
        <SummaryCard title="Latest Sales" value={formatValue(latestSales)} />
        <SummaryCard title="Latest Net Profit" value={formatValue(latestNetProfit)} />
        <SummaryCard title="Latest Borrowings" value={formatValue(latestBorrowings)} />
        <SummaryCard title="Latest CFO" value={formatValue(latestCfo)} />
        <SummaryCard title="Latest Cash Balance" value={formatValue(latestCash)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Coverage
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "META",
              "PROFIT_LOSS",
              "QUARTERS",
              "BALANCE_SHEET",
              "CASH_FLOW",
              "PRICE",
              "DERIVED",
            ].map((key) => {
              const available = header.sectionsAvailable.includes(key);
              return (
                <span
                  key={key}
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    available
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {key}
                </span>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-zinc-500">
            Imported-only coverage. External enrichment is not enabled yet.
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Data Quality
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="text-zinc-500">Imported data score</div>
            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
              {importedSnapshot.scorecards.importedDataQualityScore}/100
            </div>
            <div className="text-zinc-500">Confidence</div>
            <div className="text-zinc-800 dark:text-zinc-200">
              {importedSnapshot.scorecards.confidence}
            </div>
          </div>
          {importedSnapshot.scorecards.reasons.length === 0 ? (
            <div className="mt-3 text-sm text-zinc-500">No quality warnings</div>
          ) : (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              {importedSnapshot.scorecards.reasons.slice(0, 5).map((r) => (
                <li key={r.code}>{r.message}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Parser Activity
          </div>
          {warnings.length === 0 ? (
            <div className="mt-3 text-sm text-zinc-500">No warnings</div>
          ) : (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
              {warnings.slice(0, 10).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        {importedSnapshot.coverageCounts && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Data Coverage
            </div>
            <div className="mt-3 space-y-2">
              {importedSnapshot.coverageCounts.map((item) => {
                const count = item.total;
                const colorClass =
                  count >= 10
                    ? "bg-emerald-100 text-emerald-800"
                    : count >= 5
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800";
                return (
                  <div key={item.category} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400 capitalize">
                      {item.category.replace("-", " ")}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
                      {item.nonNull}/{item.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Imported Metrics — Grouped Scorecards
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricGroupSection
            title="Profitability"
            metrics={metricsByGroup.profitability}
            dimensions={importedSnapshot.scorecards.dimensions}
          />
          <MetricGroupSection
            title="Growth"
            metrics={metricsByGroup.growth}
            dimensions={importedSnapshot.scorecards.dimensions}
          />
          <MetricGroupSection
            title="Balance sheet"
            metrics={metricsByGroup.balance_sheet}
            dimensions={importedSnapshot.scorecards.dimensions}
          />
          <MetricGroupSection
            title="Cash flow"
            metrics={metricsByGroup.cash_flow}
            dimensions={importedSnapshot.scorecards.dimensions}
          />
          <MetricGroupSection
            title="Data completeness"
            metrics={metricsByGroup.data_completeness}
            dimensions={importedSnapshot.scorecards.dimensions}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Present vs Missing — By Category
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CoverageGroupSection title="Profitability" items={coverageByGroup.profitability} />
          <CoverageGroupSection title="Balance Sheet" items={coverageByGroup.balance_sheet} />
          <CoverageGroupSection title="Cash Flow" items={coverageByGroup.cash_flow} />
          {coverageByGroup.valuation.length > 0 && (
            <CoverageGroupSection title="Valuation" items={coverageByGroup.valuation} />
          )}
          {coverageByGroup.ownership_governance.length > 0 && (
            <CoverageGroupSection
              title="Ownership / Governance"
              items={coverageByGroup.ownership_governance}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockTrendChart
          title="Annual price trend"
          data={annualPrices.map((p) => ({ date: p.date, value: p.value }))}
          lines={[{ key: "value", name: "Price", stroke: "#2563eb" }]}
        />
        <StockTrendChart
          title="Sales trend"
          data={series.sales.map((p) => ({ date: p.date, value: p.value }))}
          lines={[{ key: "value", name: "Sales", stroke: "#0f766e" }]}
        />
        <StockTrendChart
          title="Net profit trend"
          data={series.netProfit.map((p) => ({ date: p.date, value: p.value }))}
          lines={[{ key: "value", name: "PAT", stroke: "#4f46e5" }]}
        />
        <StockTrendChart
          title="Borrowings trend"
          data={series.borrowings.map((p) => ({ date: p.date, value: p.value }))}
          lines={[{ key: "value", name: "Borrowings", stroke: "#b45309" }]}
        />
        <StockTrendChart
          title="CFO vs PAT"
          data={series.patAndCfo.map((p) => ({
            date: p.date,
            pat: p.pat,
            cfo: p.cfo,
          }))}
          lines={[
            { key: "pat", name: "PAT", stroke: "#4f46e5" },
            { key: "cfo", name: "CFO", stroke: "#0f766e" },
          ]}
        />
        <StockTrendChart
          title="Cash balance trend"
          data={series.cashBalance.map((p) => ({ date: p.date, value: p.value }))}
          lines={[{ key: "value", name: "Cash", stroke: "#2563eb" }]}
        />
      </div>

      {/* Quarterly Trends Section */}
      {importedSnapshot.quarterlySeries && (
        <div className="space-y-4">
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Quarterly Trends (Last 8 Quarters)
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {importedSnapshot.quarterlySeries.sales.length > 0 && (
              <StockTrendChart
                title="Quarterly Revenue"
                data={importedSnapshot.quarterlySeries.sales
                  .slice(-8)
                  .map((p) => ({ date: p.date, value: p.value }))}
                lines={[{ key: "value", name: "Revenue", stroke: "#0f766e" }]}
              />
            )}
            {importedSnapshot.quarterlySeries.netProfit.length > 0 && (
              <StockTrendChart
                title="Quarterly Net Profit"
                data={importedSnapshot.quarterlySeries.netProfit
                  .slice(-8)
                  .map((p) => ({ date: p.date, value: p.value }))}
                lines={[{ key: "value", name: "Net Profit", stroke: "#4f46e5" }]}
              />
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Analysis readiness
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="text-zinc-600 dark:text-zinc-400">
            Annual records: {series.sales.length}
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Quarterly records: {series.quarterlySales.length}
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Balance-sheet points: {series.borrowings.length}
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Cash-flow points: {series.cfo.length}
          </div>
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          Ready for scoring requires minimum historical points across sections.
        </div>
      </div>

      {/* Enrichment Status Section */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Ownership & Governance
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          Enrichment connectors: shareholding, pledged data, insider trading
        </div>
        
        {/* Ownership & Governance Summary */}
        {(() => {
          // Build summary from available connector data (currently using parser-ready placeholders)
          const summary = buildOwnershipGovernanceSummary({
            // In production, these would come from actual connector fetch
            // For now, showing parser-ready state
          });
          const riskSignals = calculateRiskSignals(summary);
          
          return (
            <div className="mt-3 space-y-4">
              {/* Connector Status */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Shareholding', status: 'implemented', confidence: summary.shareholding ? 0.9 : 0 },
                  { label: 'Pledged Data', status: 'implemented', confidence: summary.pledged ? 0.85 : 0 },
                  { label: 'Insider Trading', status: 'implemented', confidence: summary.insider ? 0.8 : 0 },
                ].map((connector) => (
                  <div key={connector.label} className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-1.5 dark:bg-zinc-900">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {connector.label}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {connector.status}
                    </span>
                    {connector.confidence > 0 && (
                      <span className="text-xs text-zinc-500">
                        {Math.round(connector.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Shareholding Summary */}
              {summary.shareholding && (
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Shareholding Pattern
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Promoter</span>
                      <span className="font-mono text-zinc-800">
                        {summary.shareholding.promoter_pct?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Public</span>
                      <span className="font-mono text-zinc-800">
                        {summary.shareholding.public_pct?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">FII/FPI</span>
                      <span className="font-mono text-zinc-800">
                        {summary.shareholding.fii_fpi_pct?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">DII</span>
                      <span className="font-mono text-zinc-800">
                        {summary.shareholding.dii_pct?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                  </div>
                  {summary.shareholding.reporting_period && (
                    <div className="mt-2 text-xs text-zinc-500">
                      Period: {summary.shareholding.reporting_period}
                    </div>
                  )}
                  {summary.shareholding.trend_available && (
                    <div className="mt-1 text-xs text-emerald-600">
                      ✓ Trend data available
                    </div>
                  )}
                </div>
              )}

              {/* Pledged Data Summary */}
              {summary.pledged && (
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Pledged Data
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Pledge % of Promoter</span>
                      <span className={`font-mono ${summary.pledged.pledge_of_promoter_pct && summary.pledged.pledge_of_promoter_pct > 50 ? 'text-red-600' : 'text-zinc-800'}`}>
                        {summary.pledged.pledge_of_promoter_pct?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Pledge % of Total</span>
                      <span className="font-mono text-zinc-800">
                        {summary.pledged.pledge_of_total_pct?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                    {summary.pledged.encumbered_pct !== null && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Encumbered %</span>
                        <span className="font-mono text-zinc-800">
                          {summary.pledged.encumbered_pct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {summary.pledged.reporting_period && (
                    <div className="mt-2 text-xs text-zinc-500">
                      Period: {summary.pledged.reporting_period}
                    </div>
                  )}
                </div>
              )}

              {/* Insider Trading Summary */}
              {summary.insider && (
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Insider Trading
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Category</span>
                      <span className="font-mono text-zinc-800">
                        {summary.insider.insider_category ?? '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Transaction Type</span>
                      <span className="font-mono text-zinc-800">
                        {summary.insider.transaction_type ?? '—'}
                      </span>
                    </div>
                    {summary.insider.buy_summary_pct !== null && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Buy % of Shares</span>
                        <span className="font-mono text-emerald-600">
                          +{summary.insider.buy_summary_pct.toFixed(2)}%
                        </span>
                      </div>
                    )}
                    {summary.insider.sell_summary_pct !== null && (
                      <div className="flex justify-between">
                        <span className="text-zinc-600">Sell % of Shares</span>
                        <span className="font-mono text-red-600">
                          -{summary.insider.sell_summary_pct.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {summary.insider.reporting_period && (
                    <div className="mt-2 text-xs text-zinc-500">
                      Period: {summary.insider.reporting_period}
                    </div>
                  )}
                </div>
              )}

              {/* Risk Signals */}
              {riskSignals.length > 0 && (
                <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
                  <div className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                    Risk Signals
                  </div>
                  <div className="space-y-1">
                    {riskSignals.map((signal, idx) => (
                      <div key={idx} className={`flex items-start gap-2 text-xs ${
                        signal.severity === 'high' ? 'text-red-700 dark:text-red-400' :
                        signal.severity === 'medium' ? 'text-amber-700 dark:text-amber-400' :
                        'text-zinc-600 dark:text-zinc-400'
                      }`}>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          signal.severity === 'high' ? 'bg-red-100 text-red-800' :
                          signal.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-zinc-100 text-zinc-600'
                        }`}>
                          {signal.severity}
                        </span>
                        <span>{signal.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall Status */}
              <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="text-xs text-zinc-500">
                  Parser-ready connectors: {summary.is_parser_ready ? '✓' : '✗'}
                </div>
                <div className="text-xs text-zinc-500">
                  Overall confidence: {Math.round(summary.overall_confidence * 100)}%
                </div>
              </div>

              {summary.warnings.length > 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {summary.warnings.map((w, i) => (
                    <div key={i}>⚠ {w}</div>
                  ))}
                </div>
              )}

              <div className="text-xs text-zinc-400">
                {summary.notes.join(' ')}
              </div>
            </div>
          );
        })()}

        {/* Price Enrichment Section (Phase 8) */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Price Enrichment
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            External price data from Yahoo-style source (unofficial)
          </div>
          
          <div className="mt-3 space-y-3">
            {/* Connector Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Price History (Yahoo Assumption)
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                implemented
              </span>
            </div>

            {/* Price Data Placeholder */}
            <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
              <div className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Price Data (Parser Ready)
              </div>
              
              {/* Current Price / Previous Close */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Current Price</span>
                  <span className="font-mono text-zinc-800">—</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Previous Close</span>
                  <span className="font-mono text-zinc-800">—</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">52W High</span>
                  <span className="font-mono text-zinc-800">—</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">52W Low</span>
                  <span className="font-mono text-zinc-800">—</span>
                </div>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                Parser/normalizer ready. Live fetch disabled (source unstable).
              </div>
            </div>

            {/* Historical Points Summary */}
            <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
              <div className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Historical Points
              </div>
              <div className="text-xs text-zinc-500">
                <div>Points: —</div>
                <div>Latest: —</div>
                <div>Oldest: —</div>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                Connector can parse valid payloads with date, close, open/high/low/volume.
              </div>
            </div>

            {/* Warnings/Notes */}
            <div className="text-xs text-amber-600 dark:text-amber-400">
              ⚠ Live price fetch is currently disabled. Connector is parser-ready only.
            </div>
            <div className="text-xs text-zinc-400">
              Source: Yahoo-style (unofficial/unstable). Rate limits not guaranteed. Caching required if re-enabled.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
