import { describe, it, expect } from 'vitest';
import {
  nsePledgedDataConnector,
  NSEPledgedDataRaw,
  examplePledgedDataPayload
} from './nsePledgedDataConnector';

describe('NSE Pledged Data Connector', () => {
  describe('parseAndNormalize', () => {
    it('should parse valid pledged data payload correctly', () => {
      const result = nsePledgedDataConnector.parseAndNormalize(
        examplePledgedDataPayload
      );

      expect(result.total_promoter_holding_pct).toBe(50.0); // 3382500000/6765000000 * 100
      expect(result.promoter_shares_encumbered_pct).toBe(5.0);
      expect(result.pledged_shares_pct_of_promoter).toBe(5.0);
      expect(result.pledged_shares_pct_of_total).toBe(2.5);
      expect(result.reporting_period).toBe('Dec 2023');
      expect(result.evidence.source_id).toBe('nse-pledged');
      expect(result.evidence.reporting_period).toBe('Dec 2023');
    });

    it('should handle missing promoterHolding gracefully', () => {
      const invalidPayload = {
        symbol: 'TEST',
        companyName: 'Test Company'
        // missing promoterHolding and pledgedDetails
      };

      const result = nsePledgedDataConnector.parseAndNormalize(invalidPayload);

      expect(result.total_promoter_holding_pct).toBeNull();
      expect(result.promoter_shares_encumbered_pct).toBeNull();
      expect(result.pledged_shares_pct_of_promoter).toBeNull();
      expect(result.pledged_shares_pct_of_total).toBeNull();
      expect(result.warnings).toContain('No promoterHolding found in payload');
      expect(result.warnings).toContain('No pledgedDetails found in payload');
    });

    it('should handle null/undefined values in promoterHolding', () => {
      const payload: NSEPledgedDataRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingDate: '2023-12-31',
        promoterHolding: {
          totalShares: null as unknown as number,
          encumberedShares: null as unknown as number,
          encumberedPct: null as unknown as number
        },
        pledgedDetails: {
          pledgedShares: null as unknown as number,
          pledgedPctOfPromoter: undefined as unknown as number,
          pledgedPctOfTotal: null as unknown as number
        },
        reportingPeriod: 'Dec 2023'
      };

      const result = nsePledgedDataConnector.parseAndNormalize(payload);

      expect(result.total_promoter_holding_pct).toBeNull();
      expect(result.promoter_shares_encumbered_pct).toBeNull();
      expect(result.pledged_shares_pct_of_promoter).toBeNull();
      expect(result.pledged_shares_pct_of_total).toBeNull();
    });

    it('should handle string percentage values', () => {
      const payload: NSEPledgedDataRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingDate: '2023-12-31',
        promoterHolding: {
          totalShares: 5000000000,
          encumberedShares: 250000000,
          encumberedPct: '5.0%' as unknown as number
        },
        pledgedDetails: {
          pledgedShares: 250000000,
          pledgedPctOfPromoter: '5.0%' as unknown as number,
          pledgedPctOfTotal: '2.5%' as unknown as number
        },
        reportingPeriod: 'Dec 2023'
      };

      const result = nsePledgedDataConnector.parseAndNormalize(payload);

      expect(result.promoter_shares_encumbered_pct).toBe(5.0);
      expect(result.pledged_shares_pct_of_promoter).toBe(5.0);
      expect(result.pledged_shares_pct_of_total).toBe(2.5);
    });

    it('should warn when pledged % of promoter exceeds 100%', () => {
      const payload: NSEPledgedDataRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingDate: '2023-12-31',
        promoterHolding: {
          totalShares: 5000000000,
          encumberedShares: 5000000000, // 100% encumbered
          encumberedPct: 100.0
        },
        pledgedDetails: {
          pledgedShares: 6000000000, // More than promoter holding!
          pledgedPctOfPromoter: 120.0, // Exceeds 100%
          pledgedPctOfTotal: 60.0
        },
        reportingPeriod: 'Dec 2023'
      };

      const result = nsePledgedDataConnector.parseAndNormalize(payload);

      expect(result.warnings?.some(w => w.includes('exceeds 100%'))).toBe(true);
    });

    it('should handle invalid raw data (non-object)', () => {
      const result = nsePledgedDataConnector.parseAndNormalize(null);

      expect(result.total_promoter_holding_pct).toBeNull();
      expect(result.warnings).toContain('Invalid or empty raw data payload');
    });

    it('should calculate confidence correctly', () => {
      const fullPayload: NSEPledgedDataRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingDate: '2023-12-31',
        promoterHolding: {
          totalShares: 5000000000,
          encumberedShares: 250000000,
          encumberedPct: 5.0
        },
        pledgedDetails: {
          pledgedShares: 250000000,
          pledgedPctOfPromoter: 5.0,
          pledgedPctOfTotal: 2.5
        },
        reportingPeriod: 'Dec 2023'
      };

      const fullResult = nsePledgedDataConnector.parseAndNormalize(fullPayload);
      expect(fullResult.evidence.confidence).toBe(1.0); // All 4 values present

      const partialPayload: NSEPledgedDataRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingDate: '2023-12-31',
        // totalShares omitted so totalPromoterHoldingPct will be null
        promoterHolding: {
          totalShares: null as unknown as number,
          encumberedShares: null as unknown as number,
          encumberedPct: null as unknown as number
        },
        pledgedDetails: {
          pledgedShares: null as unknown as number,
          pledgedPctOfPromoter: null as unknown as number,
          pledgedPctOfTotal: 2.5
        },
        reportingPeriod: 'Dec 2023'
      };

      const partialResult = nsePledgedDataConnector.parseAndNormalize(partialPayload);
      expect(partialResult.evidence.confidence).toBe(0.25); // 1 of 4 values present (pledgedPctOfTotal)
    });
  });

  describe('fetchAndNormalize', () => {
    it('should return graceful failure when NSE fetch is not implemented', async () => {
      const result = await nsePledgedDataConnector.fetchAndNormalize('RELIANCE');

      expect(result.success).toBe(false);
      expect(result.error).toContain('NSE fetch not implemented');
    });

    it('should have isAvailable return true (parser ready)', () => {
      expect(nsePledgedDataConnector.isAvailable()).toBe(true);
    });

    it('should have correct status', () => {
      expect(nsePledgedDataConnector.getStatus()).toBe('implemented');
    });
  });
});
