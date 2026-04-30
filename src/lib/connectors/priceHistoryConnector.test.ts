import { describe, test, expect } from 'vitest';
import { parseAndNormalize } from './priceHistoryConnector';

describe('priceHistoryConnector', () => {
  test('parseAndNormalize should handle null payload', () => {
    const result = parseAndNormalize(null, 'RELIANCE');
    expect(result.symbol).toBe('RELIANCE');
    expect(result.historical_points.length).toBe(0);
    expect(result.evidence.warnings).toContain('Empty or invalid payload');
  });

  test('parseAndNormalize should handle missing chart data', () => {
    const payload = {
      quote: {
        regularMarketPrice: 2456.75,
      },
    };
    const result = parseAndNormalize(payload, 'RELIANCE');
    expect(result.current_price).toBe(2456.75);
    expect(result.historical_points.length).toBe(0);
    expect(result.evidence.warnings).toContain('No chart data found in payload');
  });
});
