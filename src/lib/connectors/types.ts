// Connector Status Types
export type ConnectorStatus = 'not_fetched' | 'fetched' | 'error' | 'not_implemented' | 'scaffolded';

export type SourceStatus = 'planned' | 'scaffolded' | 'implemented' | 'deprecated';

// Source Descriptor for the registry
export interface SourceDescriptor {
  id: string;
  source_name: string;
  source_url: string;
  category: 'ownership' | 'governance' | 'corporate-filings' | 'price' | 'other';
  description: string;
  status: SourceStatus;
  connector_available: boolean;
  notes: string;
}

// Raw source result from fetch
export interface RawSourceResult<T = unknown> {
  source_name: string;
  source_url: string;
  fetched_at: string; // ISO timestamp
  status: ConnectorStatus;
  symbol: string;
  raw_payload: T;
  warnings?: string[];
  error?: string;
}

// Normalized output shape
export interface NormalizedSourceResult<T = unknown> {
  source_name: string;
  source_url: string;
  fetched_at: string;
  status: ConnectorStatus;
  symbol: string;
  normalized_data: T;
  confidence: number; // 0-1
  warnings?: string[];
  notes?: string;
}

// Connector run result
export interface ConnectorRunResult<T = unknown> {
  success: boolean;
  result?: NormalizedSourceResult<T>;
  error?: string;
  duration_ms?: number;
}

// Enrichment evidence / provenance metadata
export interface EnrichmentEvidence {
  source_id: string;
  source_name: string;
  fetched_at: string;
  confidence: number;
  reporting_period?: string;
  notes?: string;
  warnings?: string[];
}

// Shareholding Pattern Types
export interface ShareholdingData {
  promoter_holding_pct: number | null;
  public_holding_pct: number | null;
  fii_fpi_pct: number | null; // Foreign Institutional Investors / Foreign Portfolio Investors
  dii_pct: number | null; // Domestic Institutional Investors
  reporting_period: string | null; // e.g., "Q3 FY24"
  trend_history_available: boolean;
  evidence: EnrichmentEvidence;
  warnings?: string[];
}

// Pledged Data Types
export interface PledgedData {
  total_promoter_holding_pct: number | null;
  promoter_shares_encumbered_pct: number | null; // % of promoter shares that are encumbered
  pledged_shares_pct_of_promoter: number | null; // Pledge % of promoter holding
  pledged_shares_pct_of_total: number | null; // Pledge % of total shares
  reporting_period: string | null;
  evidence: EnrichmentEvidence;
  warnings?: string[];
}

// Insider Trading Data Types
export interface InsiderTradingData {
  reporting_period: string | null;
  transaction_type: string | null; // e.g., "Disclosure", "Initial", "Continuous"
  insider_category: string | null; // e.g., "Promoter", "Director", "KMP"
  buy_summary_pct: number | null; // Aggregate buy summary as % of total shares
  sell_summary_pct: number | null; // Aggregate sell summary as % of total shares
  evidence: EnrichmentEvidence;
  warnings?: string[];
}

// Ownership & Governance Summary
export interface OwnershipGovernanceSummary {
  // Shareholding
  shareholding?: {
    promoter_pct: number | null;
    public_pct: number | null;
    fii_fpi_pct: number | null;
    dii_pct: number | null;
    reporting_period: string | null;
    trend_available: boolean;
  };
  
  // Pledged Data
  pledged?: {
    promoter_holding_pct: number | null;
    encumbered_pct: number | null;
    pledge_of_promoter_pct: number | null;
    pledge_of_total_pct: number | null;
    reporting_period: string | null;
  };
  
  // Insider Trading
  insider?: {
    transaction_type: string | null;
    insider_category: string | null;
    buy_summary_pct: number | null;
    sell_summary_pct: number | null;
    reporting_period: string | null;
  };
  
  // Aggregate
  overall_confidence: number;
  reporting_periods: string[];
  warnings: string[];
  notes: string[];
  is_parser_ready: boolean; // true if parsers are ready (even if fetch not available)
  is_live_fetch_available: boolean; // true if live NSE fetch is implemented
}

// Risk Signal
export interface RiskSignal {
  type: 'pledge' | 'insider' | 'concentration';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

// Price History Data Types
export interface PricePoint {
  date: string; // ISO 8601 date (YYYY-MM-DD)
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export interface PriceHistoryData {
  symbol: string;
  currency?: string;
  current_price?: number;
  previous_close?: number;
  week_52_high?: number;
  week_52_low?: number;
  latest_timestamp?: string; // ISO 8601 datetime
  historical_points: PricePoint[];
  evidence: EnrichmentEvidence;
}

// Connector interface
export interface Connector<TInput = string, TOutput = unknown> {
  source_name: string;
  source_url: string;
  status: SourceStatus;
  
  // Fetch and normalize data
  fetchAndNormalize(symbol: TInput): Promise<ConnectorRunResult<TOutput>>;
  
  // Get connector status without fetching
  getStatus(): SourceStatus;
  
  // Check if connector is ready to use
  isAvailable(): boolean;
}
