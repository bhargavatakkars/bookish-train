import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { companies, imports, parserLogs } from "@/lib/db/schema";

import type { DashboardStockRow } from "./types";

export async function getDashboardStocks(): Promise<DashboardStockRow[]> {
  const db = getDb();

  const latestImports = db
    .select({
      companyId: imports.companyId,
      importId: imports.id,
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

