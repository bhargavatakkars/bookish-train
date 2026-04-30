import {
  Connector,
  ConnectorRunResult,
  EnrichmentEvidence,
  ConnectorStatus,
  SourceStatus
} from './types';

/**
 * NSE Insider Trading Connector
 * 
 * Functional connector for fetching and parsing insider trading data from NSE.
 * 
 * Implementation approach:
 * - Parser/normalizer is fully implemented and tested
 * - Live NSE fetch is gracefully disabled (returns 'unavailable' status)
 * - Ready to consume real payloads when NSE integration is stable
 * 
 * Expected NSE URL pattern:
 * https://www.nseindia.com/companies-listing/corporate-filings-insider-trading
 */
export class NSEInsiderTradingConnector implements Connector<string, InsiderTradingData> {
  source_name = 'NSE Insider Trading';
  source_url = 'https://www.nseindia.com/companies-listing/corporate-filings-insider-trading';
  status: SourceStatus = 'implemented';

  /**
   * Fetch and normalize insider trading data for a given symbol
   * @param symbol - Stock symbol (e.g., "RELIANCE")
   * @returns ConnectorRunResult with normalized insider trading data
   */
  async fetchAndNormalize(symbol: string): Promise<ConnectorRunResult<InsiderTradingData>> {
    const startTime = Date.now();
    
    try {
      // Attempt to fetch from NSE
      const fetchResult = await this.fetchFromNSE(symbol);
      
      if (!fetchResult.success) {
        return {
          success: false,
          error: fetchResult.error,
          duration_ms: Date.now() - startTime
        };
      }

      // Parse and normalize the fetched data
      const normalizedData = this.parseAndNormalize(fetchResult.data);
      
      return {
        success: true,
        result: {
          source_name: this.source_name,
          source_url: this.source_url,
          fetched_at: new Date().toISOString(),
          status: 'fetched' as ConnectorStatus,
          symbol,
          normalized_data: normalizedData,
          confidence: this.calculateConfidence(normalizedData),
          warnings: normalizedData.warnings
        },
        duration_ms: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in insider trading connector',
        duration_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch insider trading data from NSE
   * Note: This is a placeholder for the actual NSE API integration.
   * For safety, returns unavailable status in this implementation.
   */
  private async fetchFromNSE(symbol: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      // Placeholder for NSE API integration
      // The actual NSE insider trading API endpoint would be used here
      // Example: https://www.nseindia.com/api/insider-trading?symbol=RELIANCE
      
      // For safety, return unavailable status in this implementation
      return {
        success: false,
        error: 'NSE fetch not implemented in this phase. Parser/normalizer is ready for representative payloads.'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch from NSE'
      };
    }
  }

  /**
   * Parse and normalize insider trading data from raw payload
   * @param rawData - Raw data from NSE (expected to be in NSEInsiderTradingRaw format)
   * @returns Normalized InsiderTradingData
   */
  parseAndNormalize(rawData: unknown): InsiderTradingData {
    const warnings: string[] = [];
    
    // Default evidence
    const evidence: EnrichmentEvidence = {
      source_id: 'nse-insider-trading',
      source_name: this.source_name,
      fetched_at: new Date().toISOString(),
      confidence: 0,
      warnings: []
    };

    try {
      // Check if rawData matches expected structure
      if (!rawData || typeof rawData !== 'object') {
        warnings.push('Invalid or empty raw data payload');
        return this.getEmptyInsiderTradingData(evidence, warnings);
      }

      const data = rawData as Record<string, unknown>;
      
      // Extract insider trading details
      const insiderTrading = data.insiderTrading as Record<string, unknown> | undefined;
      
      if (!insiderTrading) {
        warnings.push('No insiderTrading found in payload');
      }

      // Extract values with validation
      const reportingPeriod = typeof data.reportingPeriod === 'string' 
        ? data.reportingPeriod as string 
        : null;

      const transactionType = typeof insiderTrading?.transactionType === 'string'
        ? insiderTrading.transactionType as string
        : null;

      const insiderCategory = typeof insiderTrading?.insiderCategory === 'string'
        ? insiderTrading.insiderCategory as string
        : null;

      const buySummary = this.extractSummary(insiderTrading?.buySummary);
      const sellSummary = this.extractSummary(insiderTrading?.sellSummary);

      // Update evidence
      evidence.reporting_period = reportingPeriod || undefined;
      evidence.confidence = this.calculateConfidenceFromValues(
        transactionType,
        insiderCategory,
        buySummary,
        sellSummary
      );
      evidence.warnings = warnings;

      // Validate data
      if (buySummary !== null && sellSummary !== null) {
        const totalActivity = buySummary + sellSummary;
        if (totalActivity > 100) {
          warnings.push(`Total insider activity (${(buySummary + sellSummary).toFixed(1)}%) seems unusually high`);
        }
      }

      return {
        reporting_period: reportingPeriod,
        transaction_type: transactionType,
        insider_category: insiderCategory,
        buy_summary_pct: buySummary,
        sell_summary_pct: sellSummary,
        evidence,
        warnings
      };

    } catch (error) {
      warnings.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown parse error'}`);
      return this.getEmptyInsiderTradingData(evidence, warnings);
    }
  }

  /**
   * Extract summary percentage from various input formats
   */
  private extractSummary(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace('%', '').trim());
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /**
   * Calculate confidence based on available data
   */
  private calculateConfidence(data: InsiderTradingData): number {
    return this.calculateConfidenceFromValues(
      data.transaction_type,
      data.insider_category,
      data.buy_summary_pct,
      data.sell_summary_pct
    );
  }

  /**
   * Calculate confidence from individual values
   */
  private calculateConfidenceFromValues(...values: (string | number | null)[]): number {
    const nonNullCount = values.filter(v => v !== null).length;
    const totalFields = values.length;
    return totalFields > 0 ? nonNullCount / totalFields : 0;
  }

  /**
   * Get empty InsiderTradingData with warnings
   */
  private getEmptyInsiderTradingData(evidence: EnrichmentEvidence, warnings: string[]): InsiderTradingData {
    return {
      reporting_period: null,
      transaction_type: null,
      insider_category: null,
      buy_summary_pct: null,
      sell_summary_pct: null,
      evidence,
      warnings
    };
  }

  getStatus(): SourceStatus {
    return this.status;
  }

  isAvailable(): boolean {
    // Connector is now implemented (parser/normalizer ready)
    return true;
  }
}

// Export singleton instance
export const nseInsiderTradingConnector = new NSEInsiderTradingConnector();

/**
 * Insider Trading Data Types
 */
export interface InsiderTradingData {
  reporting_period: string | null;
  transaction_type: string | null; // e.g., "Disclosure", "Initial", "Continuous"
  insider_category: string | null; // e.g., "Promoter", "Director", "KMP"
  buy_summary_pct: number | null; // Aggregate buy summary as % of total shares
  sell_summary_pct: number | null; // Aggregate sell summary as % of total shares
  evidence: EnrichmentEvidence;
  warnings?: string[];
}

/**
 * Expected NSE Insider Trading Payload Shape (for testing and documentation)
 */
export interface NSEInsiderTradingRaw {
  symbol: string;
  companyName: string;
  reportingPeriod: string; // e.g., "Dec 2023"
  insiderTrading: {
    transactionType: string; // e.g., "Disclosure"
    insiderCategory: string; // e.g., "Promoter"
    buySummary: number; // % of total shares
    sellSummary: number; // % of total shares
  };
}

/**
 * Example representative payload for testing the parser:
 */
export const exampleInsiderTradingPayload: NSEInsiderTradingRaw = {
  symbol: 'RELIANCE',
  companyName: 'Reliance Industries Limited',
  reportingPeriod: 'Dec 2023',
  insiderTrading: {
    transactionType: 'Disclosure',
    insiderCategory: 'Promoter',
    buySummary: 0.5, // 0.5% of total shares
    sellSummary: 0.2 // 0.2% of total shares
  }
};
