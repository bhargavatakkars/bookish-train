import "server-only";

import type { ScreenerParsedSections } from "./screenerDataSheetParser";

export type NormalizedStatementItem = {
  statementDate: string;
  metricKey: string;
  metricLabel: string;
  value: string | null;
};

export type NormalizedStatements = {
  profitLossAnnual: NormalizedStatementItem[];
  profitLossQuarterly: NormalizedStatementItem[];
  balanceSheet: NormalizedStatementItem[];
  cashFlow: NormalizedStatementItem[];
};

export type ImportMetaSnapshot = {
  companyName: string | null;
  currentPrice: string | null;
  marketCap: string | null;
  faceValue: string | null;
  shares: string | null;
  sharesAdjCr: string | null;
  annualPrices: Array<{ year: string; price: string | null }>;
};

function toMetricKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 128);
}

function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length === 0 ? null : str;
}

function normalizeWideTable(
  section: {
    periodHeaders: string[];
    rows: Array<{ label: string; values: unknown[] }>;
  },
): NormalizedStatementItem[] {
  const items: NormalizedStatementItem[] = [];
  const dates = section.periodHeaders;
  for (const row of section.rows) {
    const metricLabel = row.label;
    const metricKey = toMetricKey(metricLabel);
    for (let i = 0; i < dates.length; i++) {
      const statementDate = dates[i]!;
      items.push({
        statementDate,
        metricKey,
        metricLabel,
        value: valueToString(row.values[i]),
      });
    }
  }
  return items;
}

export function normalizeParsedSections(
  sections: ScreenerParsedSections,
): NormalizedStatements {
  const profitLossAnnual = sections.PROFIT_LOSS
    ? normalizeWideTable(sections.PROFIT_LOSS)
    : [];
  const profitLossQuarterly = sections.QUARTERS
    ? normalizeWideTable(sections.QUARTERS)
    : [];
  const balanceSheet = sections.BALANCE_SHEET
    ? normalizeWideTable(sections.BALANCE_SHEET)
    : [];
  const cashFlow = sections.CASH_FLOW
    ? normalizeWideTable(sections.CASH_FLOW)
    : [];

  return {
    profitLossAnnual,
    profitLossQuarterly,
    balanceSheet,
    cashFlow,
  };
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function firstValueAsString(row: { values: unknown[] }): string | null {
  const value = row.values.find((v) => v !== null && v !== undefined);
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length === 0 ? null : str;
}

export function extractImportMetaSnapshot(
  sections: ScreenerParsedSections,
): ImportMetaSnapshot {
  const metaRows = sections.META?.rows ?? [];
  const derivedRows = sections.DERIVED?.rows ?? [];
  const priceRows = sections.PRICE?.rows ?? [];

  const rowMap = new Map<string, { values: unknown[] }>();
  for (const row of [...metaRows, ...derivedRows]) {
    rowMap.set(normalizeLabel(row.label), { values: row.values });
  }

  const companyName =
    firstValueAsString(
      rowMap.get("company name") ?? { values: [] },
    ) ?? null;
  const currentPrice =
    firstValueAsString(rowMap.get("current price") ?? { values: [] }) ?? null;
  const marketCap =
    firstValueAsString(rowMap.get("market cap") ?? { values: [] }) ?? null;
  const faceValue =
    firstValueAsString(rowMap.get("face value") ?? { values: [] }) ?? null;
  const shares =
    firstValueAsString(rowMap.get("number of shares") ?? { values: [] }) ?? null;
  const sharesAdjCr =
    firstValueAsString(
      rowMap.get("adjusted equity shares in cr") ?? { values: [] },
    ) ?? null;

  const annualPrices: Array<{ year: string; price: string | null }> = [];
  if (sections.PRICE) {
    const years = sections.PRICE.periodHeaders;
    const annualRow = priceRows.find(
      (r) => normalizeLabel(r.label) === "annual price",
    );

    if (annualRow) {
      for (let i = 0; i < years.length; i++) {
        annualPrices.push({
          year: years[i]!,
          price: valueToString(annualRow.values[i]),
        });
      }
    }
  }

  return {
    companyName,
    currentPrice,
    marketCap,
    faceValue,
    shares,
    sharesAdjCr,
    annualPrices,
  };
}
