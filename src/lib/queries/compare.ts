export interface CompareStockData {
  symbol: string;
  name: string | null;
  importedMetrics: unknown | null;
  ownershipSummary: unknown | null;
  priceData: unknown | null;
  warnings: string[];
  coverageGaps: string[];
}

export interface CompareViewModel {
  stocks: CompareStockData[];
  symbols: string[];
  warnings: string[];
}

export function parseSymbolsFromQuery(query: string | string[] | undefined): string[] {
  if (!query) return [];  
  
  const queryStr = Array.isArray(query) ? query.join(',') : query;
  if (!queryStr) return [];
  
  const symbols = queryStr.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
  
  // Dedupe while preserving order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of symbols) {
    if (!seen.has(s)) {
      seen.add(s);
      result.push(s);
    }
  }
  
  return result;
}

// Simplified getCompareData that doesn't import server-only modules
// In production, this would fetch from DB
export async function getCompareData(symbols: string[]): Promise<CompareViewModel> {
  const warnings: string[] = [];
  const stocks: CompareStockData[] = [];

  const uniqueSymbols = [...new Set(symbols.map(s => s.trim().toUpperCase()))];

  if (uniqueSymbols.length === 0) {
    warnings.push("No symbols provided for comparison");
    return { stocks, symbols: [], warnings };
  }

  if (uniqueSymbols.length > 10) {
    warnings.push("Maximum 10 symbols allowed for comparison. Truncating.");
    uniqueSymbols.splice(10);
  }

  for (const symbol of uniqueSymbols) {
    stocks.push({
      symbol,
      name: null,
      importedMetrics: null,
      ownershipSummary: null,
      priceData: null,
      warnings: ['Compare data fetching not fully implemented yet for ' + symbol],
      coverageGaps: ['Full implementation would fetch from DB'],
    });
  }

  return {
    stocks,
    symbols: uniqueSymbols,
    warnings,
  };
}
