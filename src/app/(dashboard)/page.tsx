import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { SummaryCard } from "@/components/SummaryCard";
import {
  getDashboardStats,
  getDashboardStocks,
  getRecentImports,
  getSystemHealthSummary,
} from "@/lib/queries/dashboard";

export default async function DashboardPage() {
  const [stats, stocks, recentImports, health] = await Promise.all([
    getDashboardStats(),
    getDashboardStocks(),
    getRecentImports(5),
    getSystemHealthSummary(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Imported stocks and latest Screener parse status.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Imported Companies"
          value={String(stats.totalCompanies)}
          subtitle="Companies present in DB"
        />
        <SummaryCard
          title="Total Imports"
          value={String(stats.totalImports)}
          subtitle="All Screener imports"
        />
        <SummaryCard
          title="Imports w/ warnings"
          value={String(health.importsWithWarnings)}
          subtitle="Distinct imports emitting warnings"
        />
        <SummaryCard
          title="Warnings (7d)"
          value={String(health.warningsLast7d)}
          subtitle={health.lastImportAt ? `Last import ${health.lastImportAt.toISOString()}` : "No imports"}
        />
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title="No imports yet"
          body="Upload a Screener XLSX to start building your dashboard."
          ctaHref="/import"
          ctaLabel="Import Screener XLSX"
        />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Stocks
            </div>
            <Link
              href="/import"
              className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
            >
              Import
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">Symbol</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Market cap</th>
                  <th className="px-4 py-3">Latest import</th>
                  <th className="px-4 py-3">Warnings</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => (
                  <tr
                    key={stock.companyId}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                      {stock.symbol}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                      {stock.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {stock.currentPrice ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {stock.marketCap ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {stock.latestImportAt
                        ? stock.latestImportAt.toISOString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {stock.warningCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/stocks/${encodeURIComponent(stock.symbol)}`}
                        className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentImports.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-800 dark:text-zinc-200">
            Recent imports
          </div>
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {recentImports.map((imp) => (
              <li key={imp.importId} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col">
                  <div className="text-zinc-800 dark:text-zinc-200">
                    {imp.name ?? imp.symbol}{" "}
                    <span className="font-mono text-xs text-zinc-500">{imp.symbol}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {imp.importedAt.toISOString()} · warnings {imp.warningCount}
                  </div>
                </div>
                <Link
                  href={`/stocks/${encodeURIComponent(imp.symbol)}`}
                  className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
