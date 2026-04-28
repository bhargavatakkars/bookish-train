import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  balanceSheetItems,
  cashFlowItems,
  companies,
  importRawPayloads,
  imports,
  parserLogs,
  profitLossItems,
} from "@/lib/db/schema";

import type { MetricPoint, StockHeader, StockTimeSeries } from "./types";

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
  };
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
  const where = [eq(params.table.companyId, params.companyId), eq(params.table.metricKey, params.metricKey)];
  if (params.table === profitLossItems && params.frequency) {
    where.push(eq(profitLossItems.frequency, params.frequency));
  }

  const rows = await db
    .select({
      statementDate: params.table.statementDate,
      value: params.table.value,
    })
    .from(params.table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(and(...(where as any)))
    .orderBy(params.table.statementDate);

  return rows.map((r) => ({ date: r.statementDate, value: toNumberOrNull(r.value) }));
}

export async function getStockTimeSeries(
  companyId: string,
): Promise<StockTimeSeries> {
  const [sales, netProfit, borrowings, cfo, cashBalance] = await Promise.all([
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
    getMetricSeries({ companyId, table: cashFlowItems, metricKey: "cash_from_operating_activity" }),
    getMetricSeries({ companyId, table: balanceSheetItems, metricKey: "cash_equivalents" }),
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
    cfo,
    cashBalance,
    patAndCfo,
  };
}

