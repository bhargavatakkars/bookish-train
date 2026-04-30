import type {
  Connector,
  ConnectorRunResult,
  PriceHistoryData,
  PricePoint,
  EnrichmentEvidence,
  SourceStatus,
} from './types';

/**
 * Price History Connector
 *
 * @source Assumption: Yahoo-style price data (unofficial/unstable)
 * @warning This source is NOT official. Rate limits are not guaranteed.
 * @caching Caching is required. Source may be disabled later without breaking the app.
 */

// ---------------------------------------------------------------------------
// Types for raw payload (Yahoo-style assumption)
// ---------------------------------------------------------------------------

interface YahooQuoteResponse {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketDayHigh52Week?: number;
  regularMarketDayLow52Week?: number;
  currency?: string;
  timestamp?: number;
}

interface YahooChartResponse {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: number[];
      high?: number[];
      low?: number[];
      close?: number[];
      volume?: number[];
    }>;
  };
}

interface YahooPricePayload {
  quote?: YahooQuoteResponse;
  chart?: YahooChartResponse;
}

// ---------------------------------------------------------------------------
// Parser / Normalizer
// ---------------------------------------------------------------------------

export function parseAndNormalize(
  raw: unknown,
  symbol: string
): PriceHistoryData {
  const evidence: EnrichmentEvidence = {
    source_id: 'price-history',
    source_name: 'yahoo-assumption',
    fetched_at: new Date().toISOString(),
    confidence: 0, // will be updated later
  };

  // Default shape
  const result: PriceHistoryData = {
    symbol,
    historical_points: [],
    evidence,
  };

  // --- Validate payload ---
  if (!raw || typeof raw !== 'object') {
    evidence.confidence = 0;
    evidence.warnings = ['Empty or invalid payload'];
    return result;
  }

  const payload = raw as YahooPricePayload;
  let confidence = 0;

  // --- Parse quote data (current price, 52-week range) ---
  if (payload.quote && typeof payload.quote === 'object') {
    const q = payload.quote;
    if (typeof q.regularMarketPrice === 'number') {
      result.current_price = q.regularMarketPrice;
      confidence += 0.3;
    }
    if (typeof q.regularMarketPreviousClose === 'number') {
      result.previous_close = q.regularMarketPreviousClose;
      confidence += 0.15;
    }
    if (typeof q.regularMarketDayHigh52Week === 'number') {
      result.week_52_high = q.regularMarketDayHigh52Week;
      confidence += 0.1;
    }
    if (typeof q.regularMarketDayLow52Week === 'number') {
      result.week_52_low = q.regularMarketDayLow52Week;
      confidence += 0.1;
    }
    if (typeof q.currency === 'string') {
      result.currency = q.currency;
    }
    if (typeof q.timestamp === 'number') {
      result.latest_timestamp = new Date(q.timestamp * 1000).toISOString();
    }
  } else {
    evidence.warnings = evidence.warnings || [];
    evidence.warnings.push('No quote data found in payload');
  }

  // --- Parse chart data (historical points) ---
  let validPointsCount = 0;
  if (payload.chart && typeof payload.chart === 'object') {
    const chart = payload.chart;
    const timestamps = chart.timestamp || [];
    const quote = chart.indicators?.quote?.[0];

    if (timestamps.length > 0 && quote) {
      const len = timestamps.length;
      const closes = quote.close || [];
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const volumes = quote.volume || [];

      for (let i = 0; i < len; i++) {
        if (typeof closes[i] !== 'number') continue;
        const point: PricePoint = {
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          close: closes[i],
        };
        if (typeof opens[i] === 'number') point.open = opens[i];
        if (typeof highs[i] === 'number') point.high = highs[i];
        if (typeof lows[i] === 'number') point.low = lows[i];
        if (typeof volumes[i] === 'number') point.volume = volumes[i];
        result.historical_points.push(point);
        validPointsCount++;
      }
      if (validPointsCount > 0) {
        confidence += 0.35;
      } else {
        evidence.warnings = evidence.warnings || [];
        evidence.warnings.push('No valid historical points found in chart data');
      }
    } else {
      evidence.warnings = evidence.warnings || [];
      evidence.warnings.push('No chart data found in payload');
    }
  } else {
    evidence.warnings = evidence.warnings || [];
    evidence.warnings.push('No chart data found in payload');
  }

  // --- Finalize ---
  if (result.historical_points.length > 0) {
    // Sort by date ascending
    result.historical_points.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);
  evidence.confidence = parseFloat(confidence.toFixed(2));
  
  return result;
}

// ---------------------------------------------------------------------------
// Live Fetch (Graceful)
// ---------------------------------------------------------------------------

export async function fetchAndNormalize(
  symbol: string
): Promise<PriceHistoryData> {
  const evidence: EnrichmentEvidence = {
    source_id: 'price-history',
    source_name: 'yahoo-assumption',
    fetched_at: new Date().toISOString(),
    confidence: 0,
    warnings: ['Live price fetch is currently disabled. Connector is parser-ready only.'],
    notes: [
      'Live fetch disabled: source is unofficial/unstable.',
      'Caching required if re-enabled.',
      'Rate limits not guaranteed.',
      'Parser/normalizer is ready for valid payloads.',
    ].join(' '),
  };

  // Graceful: Do not actually fetch in this implementation
  // Yahoo-style endpoints are unofficial and unstable.
  // This connector is parser-ready; live fetch is intentionally disabled.

  return {
    symbol,
    historical_points: [],
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Connector Export
// ---------------------------------------------------------------------------

export const priceHistoryConnector = {
  id: 'price-history',
  name: 'Price History (Yahoo Assumption)',
  status: 'implemented' as const, // parser/normalizer implemented; live fetch disabled
  fetchAndNormalize: async (symbol: string): Promise<ConnectorRunResult<PriceHistoryData>> => {
    const result = await fetchAndNormalize(symbol);
    return {
      success: true,
      result: {
        source_name: result.evidence.source_name,
        source_url: '', // not in EnrichmentEvidence
        fetched_at: result.evidence.fetched_at,
        status: 'not_fetched',
        symbol: result.symbol,
        normalized_data: result,
        confidence: result.evidence.confidence,
        warnings: result.evidence.warnings,
        notes: result.evidence.notes,
      },
    };
  },
  parseAndNormalize: (raw: unknown, symbol: string): PriceHistoryData => {
    return parseAndNormalize(raw, symbol);
  },
  getStatus: () => 'implemented' as SourceStatus,
  isAvailable: () => true,
};
