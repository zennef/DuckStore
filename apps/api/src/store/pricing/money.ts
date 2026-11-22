/** Money helpers. All amounts are integer cents; floats never enter the pricing math. */

/** Converts a dollar amount (at most 2 decimal places) to integer cents. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * `percent`% of `cents`, rounded to the cent half-up on the magnitude
 * (half away from zero), so 1% of -12345.50 is -123.46, not -123.45.
 * Pure integer arithmetic: `percent` must be a whole number.
 */
export function percentOf(cents: number, percent: number): number {
  const sign = Math.sign(cents * percent);
  const magnitude = Math.abs(cents * percent);
  return sign * Math.floor((magnitude + 50) / 100);
}

/** Formats cents as US dollars, e.g. 1234567 -> "$12,345.67". */
export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}
