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

function lastNonNull(series: Array<{ value: number | null }>): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const value = series[i]!.value;
    if (value !== null) return value;
  }
  return null;
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
            Quality scorecards
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Imported metrics
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {importedSnapshot.metrics.map((m) => (
              <div
                key={m.key}
                className="grid grid-cols-2 gap-2 rounded-md border border-zinc-100 p-2 dark:border-zinc-900"
              >
                <div className="text-zinc-600 dark:text-zinc-400">{m.label}</div>
                <div className="text-right font-semibold text-zinc-800 dark:text-zinc-200">
                  {m.unit === "%"
                    ? formatPercent(m.value)
                    : m.key === "cfo_to_pat"
                      ? formatRatio(m.value)
                      : formatRatio(m.value)}
                </div>
                {m.value === null && m.reasons.length > 0 ? (
                  <div className="col-span-2 text-xs text-zinc-500">
                    {m.reasons[0]!.message}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            Computed from imported statements only.
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Present vs missing
          </div>
          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Imported-only check for time-series metrics required for basic scoring.
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {Object.entries(importedSnapshot.coverage.pointsByMetricKey).map(
              ([key, counts]) => {
                const missing = importedSnapshot.coverage.missingMetricKeys.includes(key);
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {key}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          missing
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {missing ? "missing" : "present"}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {counts.nonNull}/{counts.total}
                      </span>
                    </div>
                  </div>
                );
              },
            )}
          </div>
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

      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Analysis readiness
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="text-zinc-600 dark:text-zinc-400">
            Annual records: {series.sales.length}
          </div>
          <div className="text-zinc-600 dark:text-zinc-400">
            Quarterly records: (not wired)
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
    </div>
  );
}
