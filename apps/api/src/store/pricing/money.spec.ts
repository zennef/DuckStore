import { formatUsd, percentOf, toCents } from './money';

describe('money', () => {
  describe('toCents', () => {
    it.each([
      [15, 1500],
      [12.34, 1234],
      [0.1, 10],
      // Float traps: 0.29 * 100 is 28.999... and 1.15 * 100 is 114.999... in binary.
      [0.29, 29],
      [1.15, 115],
      [19.99, 1999],
    ])('$%d -> %i cents', (dollars, cents) => {
      expect(toCents(dollars)).toBe(cents);
    });
  });

  describe('percentOf', () => {
    it('returns exact results when there is no remainder', () => {
      expect(percentOf(225_000, 20)).toBe(45_000);
      expect(percentOf(178_200, 18)).toBe(32_076);
    });

    it('rounds half-up on a positive amount', () => {
      expect(percentOf(1_234_550, 1)).toBe(12_346); // 12345.5
      expect(percentOf(1_234_549, 1)).toBe(12_345); // 12345.49
    });

    it('rounds the magnitude half-up for a negative percent (half away from zero)', () => {
      expect(percentOf(1_234_550, -1)).toBe(-12_346); // -12345.5
      expect(percentOf(1_234_549, -1)).toBe(-12_345); // -12345.49
    });

    it('returns 0 for a zero amount', () => {
      expect(percentOf(0, 18)).toBe(0);
    });
  });

  describe('formatUsd', () => {
    it.each([
      [1500, '$15.00'],
      [800, '$8.00'],
      [660_276, '$6,602.76'],
    ])('%i cents -> %s', (cents, text) => {
      expect(formatUsd(cents)).toBe(text);
    });
  });
});
