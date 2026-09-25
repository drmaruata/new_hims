import { describe, expect, it } from 'vitest';
import { formatCurrencyINR, formatIndianNumber } from './index';

describe('Indian localisation', () => {
  it('formats INR currency', () => {
    expect(formatCurrencyINR(123456.5)).toContain('₹');
    expect(formatCurrencyINR(123456.5)).toContain('1,23,456.50');
  });

  it('formats Indian grouping', () => {
    expect(formatIndianNumber(1234567)).toBe('12,34,567');
  });
});
