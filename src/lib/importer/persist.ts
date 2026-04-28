import "server-only";

import { eq } from "drizzle-orm";

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

import { SCREENER_PARSER_VERSION } from "./screenerDataSheetParser";
import type {
  ParsedDataSheet,
  ParserWarning,
} from "./screenerDataSheetParser";
import type {
  NormalizedStatementItem,
  NormalizedStatements,
} from "./normalize";
import type { ImportMetaSnapshot } from "./normalize";

type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export type ImportPreview = {
  parserVersion: string;
  importChecksum: string;
  warnings: ParserWarning[];
  workbookMeta: ParsedDataSheet["workbookMeta"];
  sectionKeys: string[];
  counts: {
    profitLossAnnual: number;
    profitLossQuarterly: number;
    balanceSheet: number;
    cashFlow: number;
  };
};

export async function ensureCompany(params: {
  symbol: string;
  name?: string;
}): Promise<{ id: string }>
{
  const db = getDb();
  const normalizedSymbol = params.symbol.trim().toUpperCase();
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.symbol, normalizedSymbol))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(companies)
    .values({ symbol: normalizedSymbol, name: params.name ?? null })
    .returning({ id: companies.id });
  return inserted[0]!;
}

export function buildPreview(
  parsed: ParsedDataSheet,
  normalized: NormalizedStatements,
): ImportPreview {
  return {
    parserVersion: SCREENER_PARSER_VERSION,
    importChecksum: parsed.importChecksum,
    warnings: parsed.warnings,
    workbookMeta: parsed.workbookMeta,
    sectionKeys: Object.keys(parsed.parsedSections),
    counts: {
      profitLossAnnual: normalized.profitLossAnnual.length,
      profitLossQuarterly: normalized.profitLossQuarterly.length,
      balanceSheet: normalized.balanceSheet.length,
      cashFlow: normalized.cashFlow.length,
    },
  };
}

export async function persistImport(params: {
  companyId: string;
  originalFileName?: string;
  parsed: ParsedDataSheet;
  normalized: NormalizedStatements;
  meta: ImportMetaSnapshot;
}): Promise<{ importId: string }>
{
  const db = getDb();
  return await db.transaction(async (tx) => {
    const insertedImport = await tx
      .insert(imports)
      .values({
        companyId: params.companyId,
        parserVersion: SCREENER_PARSER_VERSION,
        importChecksum: params.parsed.importChecksum,
        originalFileName: params.originalFileName ?? null,
        currentPrice: params.meta.currentPrice,
        marketCap: params.meta.marketCap,
      })
      .returning({ id: imports.id });
    const importId = insertedImport[0]!.id;

    await tx
      .update(companies)
      .set({
        name: params.meta.companyName,
        faceValue: params.meta.faceValue,
        shares: params.meta.shares,
        sharesAdjCr: params.meta.sharesAdjCr,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, params.companyId));

    await tx.insert(importRawPayloads).values({
      importId,
      workbookMeta: params.parsed.workbookMeta,
      dataSheetMatrix: params.parsed.dataSheetMatrix,
      parsedSections: params.parsed.parsedSections,
      warnings: params.parsed.warnings,
    });

    if (params.meta.annualPrices.length > 0) {
      await tx.insert(importAnnualPrices).values(
        params.meta.annualPrices.map((p) => ({
          importId,
          year: p.year,
          price: p.price,
        })),
      );
    }

    if (params.parsed.warnings.length > 0) {
      await tx.insert(parserLogs).values(
        params.parsed.warnings.map((w) => ({
          importId,
          level: "warning",
          message: w.message,
          details: w,
        })),
      );
    }

    await insertProfitLossItems(tx, {
      companyId: params.companyId,
      importId,
      annual: params.normalized.profitLossAnnual,
      quarterly: params.normalized.profitLossQuarterly,
    });
    await insertStatementItems(tx, {
      table: balanceSheetItems,
      companyId: params.companyId,
      importId,
      items: params.normalized.balanceSheet,
    });
    await insertStatementItems(tx, {
      table: cashFlowItems,
      companyId: params.companyId,
      importId,
      items: params.normalized.cashFlow,
    });

    return { importId };
  });
}

async function insertProfitLossItems(
  tx: DbTransaction,
  params: {
    companyId: string;
    importId: string;
    annual: NormalizedStatements["profitLossAnnual"];
    quarterly: NormalizedStatements["profitLossQuarterly"];
  },
) {
  const insertValues = [] as Array<
    (typeof profitLossItems.$inferInsert) & { frequency: "annual" | "quarterly" }
  >;

  for (const item of params.annual) {
    insertValues.push({
      companyId: params.companyId,
      statementDate: item.statementDate,
      frequency: "annual",
      metricKey: item.metricKey,
      metricLabel: item.metricLabel,
      value: item.value,
      sourceType: "import",
      sourceName: "screener",
      importedAt: new Date(),
      sourceUrl: null,
    });
  }
  for (const item of params.quarterly) {
    insertValues.push({
      companyId: params.companyId,
      statementDate: item.statementDate,
      frequency: "quarterly",
      metricKey: item.metricKey,
      metricLabel: item.metricLabel,
      value: item.value,
      sourceType: "import",
      sourceName: "screener",
      importedAt: new Date(),
      sourceUrl: null,
    });
  }

  if (insertValues.length === 0) return;
  await tx
    .insert(profitLossItems)
    .values(insertValues)
    .onConflictDoUpdate({
      target: [
        profitLossItems.companyId,
        profitLossItems.statementDate,
        profitLossItems.frequency,
        profitLossItems.metricKey,
      ],
      set: {
        value: profitLossItems.value,
        importedAt: new Date(),
      },
    });
}

async function insertStatementItems(
  tx: DbTransaction,
  params: {
    table: typeof balanceSheetItems | typeof cashFlowItems;
    companyId: string;
    importId: string;
    items: NormalizedStatementItem[];
  },
) {
  const now = new Date();
  const values = params.items.map((item) => ({
    companyId: params.companyId,
    statementDate: item.statementDate,
    metricKey: item.metricKey,
    metricLabel: item.metricLabel,
    value: item.value,
    sourceType: "import" as const,
    sourceName: "screener",
    sourceUrl: null,
    importedAt: now,
  }));

  if (values.length === 0) return;
  const target =
    params.table === balanceSheetItems
      ? [balanceSheetItems.companyId, balanceSheetItems.statementDate, balanceSheetItems.metricKey]
      : [cashFlowItems.companyId, cashFlowItems.statementDate, cashFlowItems.metricKey];

  await tx
    .insert(params.table)
    .values(values)
    .onConflictDoUpdate({
      target,
      set: {
        value: params.table.value,
        importedAt: now,
      },
    });
}
