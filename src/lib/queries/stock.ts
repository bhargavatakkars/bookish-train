import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  balanceSheetItems,
  cashFlowItems,
  companies,
  importAnnualPrices,
  importRawPayloads,
  imports,
  parserLogs,
  profitLossItems,
} from "@/lib/db/schema";

import { buildImportedMetricsSnapshot } from "@/lib/metrics/importedMetrics";

import type {
  MetricPoint,
  StockHeader,
  StockImportedMetricsSnapshot,
  StockTimeSeries,
} from "./types";

function toNumberOrNull(value: string | null): number | null {
  if (value === null) return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export async function getStockHeaderBySymbol(
  symbol: string,
): Promise<StockHeader | null> {
  const db = getDb();
  const normalizedSymbol = symbol.trim().toUpperCase();

  const latestImports = db
    .select({
      id: imports.id,
      companyId: imports.companyId,
      importedAt: imports.importedAt,
      rn: sql<number>`row_number() over (partition by ${imports.companyId} order by ${imports.importedAt} desc)`
        .as("rn"),
    })
    .from(imports)
    .as("latest_imports");

  const latestWarnings = db
    .select({
      importId: parserLogs.importId,
      warningCount: sql<number>`count(*)`.as("warning_count"),
    })
    .from(parserLogs)
    .where(eq(parserLogs.level, "warning"))
    .groupBy(parserLogs.importId)
    .as("latest_warnings");

  const rows = await db
    .select({
      companyId: companies.id,
      symbol: companies.symbol,
      name: companies.name,
      latestImportAt: latestImports.importedAt,
      latestImportId: latestImports.id,
      currentPrice: imports.currentPrice,
      marketCap: imports.marketCap,
      warningCount: sql<number>`coalesce(${latestWarnings.warningCount}, 0)`.as(
        "warning_count",
      ),
      parsedSections: importRawPayloads.parsedSections,
    })
    .from(companies)
    .leftJoin(
      latestImports,
      sql`${latestImports.companyId} = ${companies.id} and ${latestImports.rn} = 1`,
    )
    .leftJoin(imports, eq(imports.id, latestImports.id))
    .leftJoin(latestWarnings, eq(latestWarnings.importId, latestImports.id))
    .leftJoin(importRawPayloads, eq(importRawPayloads.importId, latestImports.id))
    .where(eq(companies.symbol, normalizedSymbol))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const sectionsAvailable = row.parsedSections
    ? Object.keys(row.parsedSections as Record<string, unknown>)
    : [];

  return {
    companyId: row.companyId,
    symbol: row.symbol,
    name: row.name,
    latestImportAt: row.latestImportAt,
    latestImportId: row.latestImportId,
    warningCount: row.warningCount,
    sectionsAvailable,
    currentPrice: row.currentPrice,
    marketCap: row.marketCap,
  };
}

export async function getAnnualPriceSeries(importId: string): Promise<MetricPoint[]> {
  const db = getDb();
  const rows = await db
    .select({ year: importAnnualPrices.year, price: importAnnualPrices.price })
    .from(importAnnualPrices)
    .where(eq(importAnnualPrices.importId, importId))
    .orderBy(importAnnualPrices.year);

  return rows.map((r) => ({ date: r.year, value: toNumberOrNull(r.price) }));
}

export async function getParserWarnings(importId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ message: parserLogs.message })
    .from(parserLogs)
    .where(and(eq(parserLogs.importId, importId), eq(parserLogs.level, "warning")))
    .orderBy(desc(parserLogs.createdAt))
    .limit(50);

  return rows.map((r) => r.message);
}

async function getMetricSeries(params: {
  companyId: string;
  table: typeof profitLossItems | typeof balanceSheetItems | typeof cashFlowItems;
  metricKey: string;
  frequency?: "annual" | "quarterly";
}): Promise<MetricPoint[]> {
  const db = getDb();
  const baseSelect = db
    .select({
      statementDate: params.table.statementDate,
      value: params.table.value,
    })
    .from(params.table)
    .orderBy(params.table.statementDate);

  const rows =
    params.table === profitLossItems
      ? await baseSelect.where(
          params.frequency
            ? and(
                eq(profitLossItems.companyId, params.companyId),
                eq(profitLossItems.metricKey, params.metricKey),
                eq(profitLossItems.frequency, params.frequency),
              )
            : and(
                eq(profitLossItems.companyId, params.companyId),
                eq(profitLossItems.metricKey, params.metricKey),
              ),
        )
      : await baseSelect.where(
          and(
            eq(params.table.companyId, params.companyId),
            eq(params.table.metricKey, params.metricKey),
          ),
        );

  return rows.map((r) => ({ date: r.statementDate, value: toNumberOrNull(r.value) }));
}

export async function getStockTimeSeries(
  companyId: string,
): Promise<StockTimeSeries> {
  const [
    sales,
    netProfit,
    borrowings,
    netWorth,
    cfo,
    cashBalance,
    quarterlySales,
    quarterlyNetProfit,
  ] = await Promise.all([
    getMetricSeries({
      companyId,
      table: profitLossItems,
      metricKey: "sales",
      frequency: "annual",
    }),
    getMetricSeries({
      companyId,
      table: profitLossItems,
      metricKey: "net_profit",
      frequency: "annual",
    }),
    getMetricSeries({
      companyId,
      table: balanceSheetItems,
      metricKey: "borrowings",
    }),
    getMetricSeries({
      companyId,
      table: balanceSheetItems,
      metricKey: "net_worth",
    }),
    getMetricSeries({ companyId, table: cashFlowItems, metricKey: "cash_from_operating_activity" }),
    getMetricSeries({ companyId, table: balanceSheetItems, metricKey: "cash_equivalents" }),
    getMetricSeries({
      companyId,
      table: profitLossItems,
      metricKey: "sales",
      frequency: "quarterly",
    }),
    getMetricSeries({
      companyId,
      table: profitLossItems,
      metricKey: "net_profit",
      frequency: "quarterly",
    }),
  ]);

  const byDate = new Map<string, { pat: number | null; cfo: number | null }>();
  for (const point of netProfit) {
    byDate.set(point.date, { pat: point.value, cfo: null });
  }
  for (const point of cfo) {
    const existing = byDate.get(point.date);
    byDate.set(point.date, { pat: existing?.pat ?? null, cfo: point.value });
  }

  const patAndCfo = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, pat: v.pat, cfo: v.cfo }));

  return {
    sales,
    netProfit,
    borrowings,
    netWorth,
    cfo,
    cashBalance,
    patAndCfo,
    quarterlySales,
    quarterlyNetProfit,
  };
}

export async function getImportedMetricsSnapshot(params: {
  header: StockHeader;
  series: StockTimeSeries;
}): Promise<StockImportedMetricsSnapshot> {
  void params.header;
  const candidateKeys = [
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

  const seriesByMetricKey: Record<string, MetricPoint[]> = {
    sales: params.series.sales,
    net_profit: params.series.netProfit,
    borrowings: params.series.borrowings,
    cash_from_operating_activity: params.series.cfo,
    cash_equivalents: params.series.cashBalance,
    net_worth: params.series.netWorth,
    ebit: [] as MetricPoint[],
    interest: [] as MetricPoint[],
    dividends: [] as MetricPoint[],
  };

  // Build the full imported‑metrics snapshot using the new orchestrator
  const snapshot = buildImportedMetricsSnapshot({
    series: {
      sales: seriesByMetricKey.sales,
      netProfit: seriesByMetricKey.net_profit,
      borrowings: seriesByMetricKey.borrowings,
      netWorth: seriesByMetricKey.net_worth,
      cfo: seriesByMetricKey.cash_from_operating_activity,
      cashBalance: seriesByMetricKey.cash_equivalents,
      ebit: seriesByMetricKey.ebit,
      interest: seriesByMetricKey.interest,
      dividends: seriesByMetricKey.dividends,
      quarterlySales: params.series.quarterlySales,
      quarterlyNetProfit: params.series.quarterlyNetProfit,
    },
    coverage: {
      availableMetricKeys: candidateKeys.filter((k) => (seriesByMetricKey[k] ?? []).length > 0),
      missingMetricKeys: candidateKeys.filter((k) => !(seriesByMetricKey[k] ?? []).length),
      pointsByMetricKey: Object.fromEntries(
        Object.entries(seriesByMetricKey).map(([k, pts]) => [k, { total: pts.length, nonNull: pts.filter((p) => p.value !== null).length }]),
      ),
    },
  });

  return {
    coverage: snapshot.coverage,
    metrics: snapshot.metrics,
    scorecards: snapshot.scorecards,
    quarterlySeries: {
      sales: params.series.quarterlySales,
      netProfit: params.series.quarterlyNetProfit,
    },
  };
}
