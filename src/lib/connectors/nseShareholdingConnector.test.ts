import { describe, it, expect } from 'vitest';
import {
  nseShareholdingConnector,
  NSEShareholdingRaw,
  exampleShareholdingPayload
} from './nseShareholdingConnector';

describe('NSE Shareholding Connector', () => {
  describe('parseAndNormalize', () => {
    it('should parse valid shareholding payload correctly', () => {
      const result = nseShareholdingConnector.parseAndNormalize(
        exampleShareholdingPayload
      );

      expect(result.promoter_holding_pct).toBe(50.5);
      expect(result.public_holding_pct).toBe(20.3);
      expect(result.fii_fpi_pct).toBe(22.4);
      expect(result.dii_pct).toBe(6.8);
      expect(result.reporting_period).toBe('Q3 FY24');
      expect(result.trend_history_available).toBe(true);
      expect(result.evidence.source_id).toBe('nse-shareholding');
      expect(result.evidence.reporting_period).toBe('Q3 FY24');
    });

    it('should handle missing shareholdingPattern gracefully', () => {
      const invalidPayload = {
        symbol: 'TEST',
        companyName: 'Test Company'
        // missing shareholdingPattern
      };

      const result = nseShareholdingConnector.parseAndNormalize(invalidPayload);

      expect(result.promoter_holding_pct).toBeNull();
      expect(result.public_holding_pct).toBeNull();
      expect(result.fii_fpi_pct).toBeNull();
      expect(result.dii_pct).toBeNull();
      expect(result.warnings).toContain('No shareholdingPattern found in payload');
    });

    it('should handle null/undefined values in shareholdingPattern', () => {
      const payload: NSEShareholdingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingQuarter: 'Q3 FY24',
        shareholdingPattern: {
          promoterAndPromoterGroup: null as unknown as number,
          publicAndOthers: 20.3,
          foreignInstitutionalInvestors: undefined as unknown as number,
          domesticInstitutionalInvestors: 6.8,
          total: 27.1 // intentionally wrong for testing
        }
      };

      const result = nseShareholdingConnector.parseAndNormalize(payload);

      expect(result.promoter_holding_pct).toBeNull();
      expect(result.fii_fpi_pct).toBeNull();
      expect(result.public_holding_pct).toBe(20.3);
      expect(result.dii_pct).toBe(6.8);
    });

    it('should handle string percentage values', () => {
      const payload: NSEShareholdingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingQuarter: 'Q3 FY24',
        shareholdingPattern: {
          promoterAndPromoterGroup: '50.5%' as unknown as number,
          publicAndOthers: '20.3%' as unknown as number,
          foreignInstitutionalInvestors: '22.4%' as unknown as number,
          domesticInstitutionalInvestors: '6.8%' as unknown as number,
          total: 100.0
        }
      };

      const result = nseShareholdingConnector.parseAndNormalize(payload);

      expect(result.promoter_holding_pct).toBe(50.5);
      expect(result.public_holding_pct).toBe(20.3);
      expect(result.fii_fpi_pct).toBe(22.4);
      expect(result.dii_pct).toBe(6.8);
    });

    it('should warn when total percentage deviates from 100%', () => {
      const payload: NSEShareholdingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingQuarter: 'Q3 FY24',
        shareholdingPattern: {
          promoterAndPromoterGroup: 60.0,
          publicAndOthers: 30.0,
          foreignInstitutionalInvestors: 15.0, // Total = 105%
          domesticInstitutionalInvestors: 0.0,
          total: 105.0
        }
      };

      const result = nseShareholdingConnector.parseAndNormalize(payload);

      expect(result.warnings?.some(w => w.includes('deviates significantly from 100%'))).toBe(true);
    });

    it('should handle empty trendData array', () => {
      const payload: NSEShareholdingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingQuarter: 'Q3 FY24',
        shareholdingPattern: {
          promoterAndPromoterGroup: 50.5,
          publicAndOthers: 20.3,
          foreignInstitutionalInvestors: 22.4,
          domesticInstitutionalInvestors: 6.8,
          total: 100.0
        },
        trendData: [] // empty array
      };

      const result = nseShareholdingConnector.parseAndNormalize(payload);

      expect(result.trend_history_available).toBe(false);
    });

    it('should handle invalid raw data (non-object)', () => {
      const result = nseShareholdingConnector.parseAndNormalize(null);

      expect(result.promoter_holding_pct).toBeNull();
      expect(result.warnings).toContain('Invalid or empty raw data payload');
    });

    it('should calculate confidence correctly', () => {
      const fullPayload: NSEShareholdingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingQuarter: 'Q3 FY24',
        shareholdingPattern: {
          promoterAndPromoterGroup: 50.5,
          publicAndOthers: 20.3,
          foreignInstitutionalInvestors: 22.4,
          domesticInstitutionalInvestors: 6.8,
          total: 100.0
        }
      };

      const fullResult = nseShareholdingConnector.parseAndNormalize(fullPayload);
      expect(fullResult.evidence.confidence).toBe(1.0); // All 4 values present

      const partialPayload: NSEShareholdingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingQuarter: 'Q3 FY24',
        shareholdingPattern: {
          promoterAndPromoterGroup: 50.5,
          publicAndOthers: null as unknown as number,
          foreignInstitutionalInvestors: null as unknown as number,
          domesticInstitutionalInvestors: 6.8,
          total: 57.3
        }
      };

      const partialResult = nseShareholdingConnector.parseAndNormalize(partialPayload);
      expect(partialResult.evidence.confidence).toBe(0.5); // 2 of 4 values present
    });
  });

  describe('fetchAndNormalize', () => {
    it('should return graceful failure when NSE fetch is not implemented', async () => {
      const result = await nseShareholdingConnector.fetchAndNormalize('RELIANCE');

      expect(result.success).toBe(false);
      expect(result.error).toContain('NSE fetch not implemented');
    });

    it('should have isAvailable return true (parser ready)', () => {
      expect(nseShareholdingConnector.isAvailable()).toBe(true);
    });

    it('should have correct status', () => {
      expect(nseShareholdingConnector.getStatus()).toBe('implemented');
    });
  });
});
