import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { companies, imports, parserLogs } from "@/lib/db/schema";

import type {
  DashboardStockRow,
  RecentImportRow,
  SystemHealthSummary,
} from "./types";

export async function getDashboardStocks(): Promise<DashboardStockRow[]> {
  const db = getDb();

  const latestImports = db
    .select({
      companyId: imports.companyId,
      importId: imports.id,
      importedAt: imports.importedAt,
      currentPrice: imports.currentPrice,
      marketCap: imports.marketCap,
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
      currentPrice: latestImports.currentPrice,
      marketCap: latestImports.marketCap,
      latestImportAt: latestImports.importedAt,
      latestImportId: latestImports.importId,
      warningCount: sql<number>`coalesce(${latestWarnings.warningCount}, 0)`.as(
        "warning_count",
      ),
    })
    .from(companies)
    .leftJoin(
      latestImports,
      sql`${latestImports.companyId} = ${companies.id} and ${latestImports.rn} = 1`,
    )
    .leftJoin(latestWarnings, eq(latestWarnings.importId, latestImports.importId))
    .orderBy(desc(latestImports.importedAt), companies.symbol);

  return rows;
}

export async function getRecentImports(limit = 5): Promise<RecentImportRow[]> {
  const db = getDb();

  const warningCounts = db
    .select({
      importId: parserLogs.importId,
      warningCount: sql<number>`count(*)`.as("warning_count"),
    })
    .from(parserLogs)
    .where(eq(parserLogs.level, "warning"))
    .groupBy(parserLogs.importId)
    .as("warning_counts");

  const rows = await db
    .select({
      importId: imports.id,
      companyId: companies.id,
      symbol: companies.symbol,
      name: companies.name,
      importedAt: imports.importedAt,
      warningCount: sql<number>`coalesce(${warningCounts.warningCount}, 0)`.as(
        "warning_count",
      ),
    })
    .from(imports)
    .innerJoin(companies, eq(companies.id, imports.companyId))
    .leftJoin(warningCounts, eq(warningCounts.importId, imports.id))
    .orderBy(desc(imports.importedAt))
    .limit(limit);

  return rows;
}

export async function getSystemHealthSummary(): Promise<SystemHealthSummary> {
  const db = getDb();

  const [totalImportsRow] = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(imports);

  const [importsWithWarningsRow] = await db
    .select({
      count: sql<number>`count(distinct ${parserLogs.importId})`.as("count"),
    })
    .from(parserLogs)
    .where(eq(parserLogs.level, "warning"));

  const [warningsLast7dRow] = await db
    .select({
      count: sql<number>`count(*)`.as("count"),
    })
    .from(parserLogs)
    .where(
      sql`${parserLogs.level} = 'warning' and ${parserLogs.createdAt} >= now() - interval '7 days'`,
    );

  const [lastImportRow] = await db
    .select({ importedAt: imports.importedAt })
    .from(imports)
    .orderBy(desc(imports.importedAt))
    .limit(1);

  return {
    totalImports: totalImportsRow?.count ?? 0,
    importsWithWarnings: importsWithWarningsRow?.count ?? 0,
    warningsLast7d: warningsLast7dRow?.count ?? 0,
    lastImportAt: lastImportRow?.importedAt ?? null,
  };
}

export async function getDashboardStats(): Promise<{
  totalCompanies: number;
  totalImports: number;
}> {
  const db = getDb();
  const [companyStats, importStats] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)`.as("count") })
      .from(companies),
    db.select({ count: sql<number>`count(*)`.as("count") }).from(imports),
  ]);

  return {
    totalCompanies: companyStats[0]?.count ?? 0,
    totalImports: importStats[0]?.count ?? 0,
  };
}
