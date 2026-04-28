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

