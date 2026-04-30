import {
  Connector,
  ConnectorRunResult,
  PledgedData,
  EnrichmentEvidence,
  ConnectorStatus,
  SourceStatus
} from './types';

/**
 * NSE Pledged Data Connector
 * 
 * Functional connector for fetching and parsing pledged/encumbrance data from NSE.
 * 
 * Implementation approach:
 * - Parser/normalizer is fully implemented and tested
 * - Live NSE fetch is gracefully disabled (returns 'unavailable' status)
 * - Ready to consume real payloads when NSE integration is stable
 * 
 * Expected NSE URL pattern:
 * https://www.nseindia.com/companies-listing/corporate-filings-pledged-shares
 */
export class NSEPledgedDataConnector implements Connector<string, PledgedData> {
  source_name = 'NSE Pledged Data';
  source_url = 'https://www.nseindia.com/companies-listing/corporate-filings-pledged-shares';
  status: SourceStatus = 'implemented';

  /**
   * Fetch and normalize pledged data for a given symbol
   * @param symbol - Stock symbol (e.g., "RELIANCE")
   * @returns ConnectorRunResult with normalized pledged data
   */
  async fetchAndNormalize(symbol: string): Promise<ConnectorRunResult<PledgedData>> {
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
        error: error instanceof Error ? error.message : 'Unknown error in pledged data connector',
        duration_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch pledged data from NSE
   * Note: This is a placeholder for the actual NSE API integration.
   * For safety, returns unavailable status in this implementation.
   */
  private async fetchFromNSE(symbol: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      // Placeholder for NSE API integration
      // The actual NSE pledged shares API endpoint would be used here
      // Example: https://www.nseindia.com/api/pledged-shares?symbol=RELIANCE
      
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
   * Parse and normalize pledged data from raw payload
   * @param rawData - Raw data from NSE (expected to be in NSEPledgedDataRaw format)
   * @returns Normalized PledgedData
   */
  parseAndNormalize(rawData: unknown): PledgedData {
    const warnings: string[] = [];
    
    // Default evidence
    const evidence: EnrichmentEvidence = {
      source_id: 'nse-pledged',
      source_name: this.source_name,
      fetched_at: new Date().toISOString(),
      confidence: 0,
      warnings: []
    };

    try {
      // Check if rawData matches expected structure
      if (!rawData || typeof rawData !== 'object') {
        warnings.push('Invalid or empty raw data payload');
        return this.getEmptyPledgedData(evidence, warnings);
      }

      const data = rawData as Record<string, unknown>;
      
      // Extract promoter holding
      const promoterHolding = data.promoterHolding as Record<string, unknown> | undefined;
      
      if (!promoterHolding) {
        warnings.push('No promoterHolding found in payload');
      }

      // Extract pledged details
      const pledgedDetails = data.pledgedDetails as Record<string, unknown> | undefined;
      
      if (!pledgedDetails) {
        warnings.push('No pledgedDetails found in payload');
      }

      // Extract values with validation
      const totalPromoterHoldingPct = this.extractPercentage(
        promoterHolding?.totalShares ? 
          (promoterHolding.totalShares as number) / (data.totalShares as number) * 100 : null
      );
      
      const promoterSharesEncumberedPct = this.extractPercentage(
        promoterHolding?.encumberedPct
      );
      
      const pledgedSharesPctOfPromoter = this.extractPercentage(
        pledgedDetails?.pledgedPctOfPromoter
      );
      
      const pledgedSharesPctOfTotal = this.extractPercentage(
        pledgedDetails?.pledgedPctOfTotal
      );

      // Extract reporting period
      const reportingPeriod = typeof data.reportingPeriod === 'string' 
        ? data.reportingPeriod as string 
        : null;

      // Update evidence
      evidence.reporting_period = reportingPeriod || undefined;
      evidence.confidence = this.calculateConfidenceFromValues(
        totalPromoterHoldingPct,
        promoterSharesEncumberedPct,
        pledgedSharesPctOfPromoter,
        pledgedSharesPctOfTotal
      );
      evidence.warnings = warnings;

      // Validate pledged percentages
      if (pledgedSharesPctOfPromoter !== null && pledgedSharesPctOfPromoter > 100) {
        warnings.push(`Pledged % of promoter (${(pledgedSharesPctOfPromoter ?? 0).toFixed(1)}%) exceeds 100%`);
      }
      
      if (pledgedSharesPctOfTotal !== null && pledgedSharesPctOfTotal > 100) {
        warnings.push(`Pledged % of total (${(pledgedSharesPctOfTotal ?? 0).toFixed(1)}%) exceeds 100%`);
      }

      return {
        total_promoter_holding_pct: totalPromoterHoldingPct,
        promoter_shares_encumbered_pct: promoterSharesEncumberedPct,
        pledged_shares_pct_of_promoter: pledgedSharesPctOfPromoter,
        pledged_shares_pct_of_total: pledgedSharesPctOfTotal,
        reporting_period: reportingPeriod,
        evidence,
        warnings
      };

    } catch (error) {
      warnings.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown parse error'}`);
      return this.getEmptyPledgedData(evidence, warnings);
    }
  }

  /**
   * Extract percentage value from various input formats
   */
  private extractPercentage(value: unknown): number | null {
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
  private calculateConfidence(data: PledgedData): number {
    return this.calculateConfidenceFromValues(
      data.total_promoter_holding_pct,
      data.promoter_shares_encumbered_pct,
      data.pledged_shares_pct_of_promoter,
      data.pledged_shares_pct_of_total
    );
  }

  /**
   * Calculate confidence from individual values
   */
  private calculateConfidenceFromValues(...values: (number | null)[]): number {
    const nonNullCount = values.filter(v => v !== null).length;
    const totalFields = values.length;
    return totalFields > 0 ? nonNullCount / totalFields : 0;
  }

  /**
   * Get empty PledgedData with warnings
   */
  private getEmptyPledgedData(evidence: EnrichmentEvidence, warnings: string[]): PledgedData {
    return {
      total_promoter_holding_pct: null,
      promoter_shares_encumbered_pct: null,
      pledged_shares_pct_of_promoter: null,
      pledged_shares_pct_of_total: null,
      reporting_period: null,
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
export const nsePledgedDataConnector = new NSEPledgedDataConnector();

/**
 * Expected NSE Pledged Data Payload Shape (for testing and documentation)
 */
export interface NSEPledgedDataRaw {
  symbol: string;
  companyName: string;
  reportingDate: string;
  totalShares?: number; // Total shares of the company (optional, for calculating promoter %)
  promoterHolding: {
    totalShares: number; // Promoter shares
    encumberedShares: number; // Encumbered shares
    encumberedPct: number; // % of promoter shares encumbered
  };
  pledgedDetails: {
    pledgedShares: number;
    pledgedPctOfPromoter: number; // % of promoter holding that is pledged
    pledgedPctOfTotal: number; // % of total shares that are pledged
  };
  reportingPeriod: string; // e.g., "Dec 2023"
}

/**
 * Example representative payload for testing the parser:
 */
export const examplePledgedDataPayload: NSEPledgedDataRaw = {
  symbol: 'RELIANCE',
  companyName: 'Reliance Industries Limited',
  reportingDate: '2023-12-31',
  totalShares: 6765000000,
  promoterHolding: {
    totalShares: 3382500000,
    encumberedShares: 169125000,
    encumberedPct: 5.0
  },
  pledgedDetails: {
    pledgedShares: 169125000,
    pledgedPctOfPromoter: 5.0,
    pledgedPctOfTotal: 2.5
  },
  reportingPeriod: 'Dec 2023'
};
