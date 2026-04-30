import { describe, it, expect } from 'vitest';
import {
  nseInsiderTradingConnector,
  NSEInsiderTradingRaw,
  exampleInsiderTradingPayload
} from './nseInsiderTradingConnector';

describe('NSE Insider Trading Connector', () => {
  describe('parseAndNormalize', () => {
    it('should parse valid insider trading payload correctly', () => {
      const result = nseInsiderTradingConnector.parseAndNormalize(
        exampleInsiderTradingPayload
      );

      expect(result.reporting_period).toBe('Dec 2023');
      expect(result.transaction_type).toBe('Disclosure');
      expect(result.insider_category).toBe('Promoter');
      expect(result.buy_summary_pct).toBe(0.5);
      expect(result.sell_summary_pct).toBe(0.2);
      expect(result.evidence.source_id).toBe('nse-insider-trading');
      expect(result.evidence.reporting_period).toBe('Dec 2023');
    });

    it('should handle missing insider trading data gracefully', () => {
      const invalidPayload = {
        symbol: 'TEST',
        companyName: 'Test Company'
        // missing insiderTrading
      };

      const result = nseInsiderTradingConnector.parseAndNormalize(invalidPayload);

      expect(result.reporting_period).toBeNull();
      expect(result.transaction_type).toBeNull();
      expect(result.insider_category).toBeNull();
      expect(result.buy_summary_pct).toBeNull();
      expect(result.sell_summary_pct).toBeNull();
      expect(result.warnings).toContain('No insiderTrading found in payload');
    });

    it('should handle null/undefined values in insiderTrading', () => {
      const payload: NSEInsiderTradingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingPeriod: 'Dec 2023',
        insiderTrading: {
          transactionType: null as unknown as string,
          insiderCategory: undefined as unknown as string,
          buySummary: null as unknown as number,
          sellSummary: undefined as unknown as number
        }
      };

      const result = nseInsiderTradingConnector.parseAndNormalize(payload);

      expect(result.transaction_type).toBeNull();
      expect(result.insider_category).toBeNull();
      expect(result.buy_summary_pct).toBeNull();
      expect(result.sell_summary_pct).toBeNull();
    });

    it('should handle string percentage values', () => {
      const payload: NSEInsiderTradingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingPeriod: 'Dec 2023',
        insiderTrading: {
          transactionType: 'Disclosure',
          insiderCategory: 'Promoter',
          buySummary: '0.5%' as unknown as number,
          sellSummary: '0.2%' as unknown as number
        }
      };

      const result = nseInsiderTradingConnector.parseAndNormalize(payload);

      expect(result.transaction_type).toBe('Disclosure');
      expect(result.insider_category).toBe('Promoter');
      expect(result.buy_summary_pct).toBe(0.5);
      expect(result.sell_summary_pct).toBe(0.2);
    });

    it('should warn when total insider activity is unusually high', () => {
      const payload: NSEInsiderTradingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingPeriod: 'Dec 2023',
        insiderTrading: {
          transactionType: 'Disclosure',
          insiderCategory: 'Promoter',
          buySummary: 60.0,
          sellSummary: 50.0 // Total = 110% which is > 100%
        }
      };

      const result = nseInsiderTradingConnector.parseAndNormalize(payload);

      expect(result.warnings?.some(w => w.includes('unusually high'))).toBe(true);
    });

    it('should handle invalid raw data (non-object)', () => {
      const result = nseInsiderTradingConnector.parseAndNormalize(null);

      expect(result.reporting_period).toBeNull();
      expect(result.warnings).toContain('Invalid or empty raw data payload');
    });

    it('should calculate confidence correctly', () => {
      const fullPayload: NSEInsiderTradingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingPeriod: 'Dec 2023',
        insiderTrading: {
          transactionType: 'Disclosure',
          insiderCategory: 'Promoter',
          buySummary: 0.5,
          sellSummary: 0.2
        }
      };

      const fullResult = nseInsiderTradingConnector.parseAndNormalize(fullPayload);
      expect(fullResult.evidence.confidence).toBe(1.0); // All 4 values present

      const partialPayload: NSEInsiderTradingRaw = {
        symbol: 'TEST',
        companyName: 'Test Company',
        reportingPeriod: 'Dec 2023',
        insiderTrading: {
          transactionType: 'Disclosure',
          insiderCategory: null as unknown as string,
          buySummary: null as unknown as number,
          sellSummary: null as unknown as number
        }
      };

      const partialResult = nseInsiderTradingConnector.parseAndNormalize(partialPayload);
      expect(partialResult.evidence.confidence).toBe(0.25); // 1 of 4 values present
    });
  });

  describe('fetchAndNormalize', () => {
    it('should return graceful failure when NSE fetch is not implemented', async () => {
      const result = await nseInsiderTradingConnector.fetchAndNormalize('RELIANCE');

      expect(result.success).toBe(false);
      expect(result.error).toContain('NSE fetch not implemented');
    });

    it('should have isAvailable return true (parser ready)', () => {
      expect(nseInsiderTradingConnector.isAvailable()).toBe(true);
    });

    it('should have correct status', () => {
      expect(nseInsiderTradingConnector.getStatus()).toBe('implemented');
    });
  });
});
