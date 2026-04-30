import { describe, it, expect } from 'vitest';
import { parseSymbolsFromQuery, getCompareData } from './compare';

describe('compare query helpers', () => {
  describe('parseSymbolsFromQuery', () => {
    it('should handle undefined', () => {
      expect(parseSymbolsFromQuery(undefined)).toEqual([]);
    });

    it('should handle empty string', () => {
      expect(parseSymbolsFromQuery('')).toEqual([]);
    });

    it('should parse comma-separated symbols', () => {
      expect(parseSymbolsFromQuery('RELIANCE,TCS,INFY')).toEqual(['RELIANCE', 'TCS', 'INFY']);
    });

    it('should handle array input', () => {
      expect(parseSymbolsFromQuery(['RELIANCE', 'TCS'])).toEqual(['RELIANCE', 'TCS']);
    });

    it('should trim and deduplicate', () => {
      const result = parseSymbolsFromQuery('reliance, TCS , RELIANCE, infy');
      expect(result).toEqual(['RELIANCE', 'TCS', 'INFY']);
    });

    it('should filter empty symbols', () => {
      expect(parseSymbolsFromQuery('RELIANCE,,TCS,')).toEqual(['RELIANCE', 'TCS']);
    });
  });

  describe('compare view-model (mocked)', () => {
    it('should handle empty symbols array', async () => {
      const result = await getCompareData([]);
      expect(result.symbols).toEqual([]);
      expect(result.warnings).toContain('No symbols provided for comparison');
    });
  });
});
