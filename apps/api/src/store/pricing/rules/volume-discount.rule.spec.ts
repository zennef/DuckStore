import { makeContext } from '../pricing-context.fixture';
import { VolumeDiscountRule } from './volume-discount.rule';

describe('VolumeDiscountRule', () => {
  const rule = new VolumeDiscountRule();

  it('returns null at exactly 100 units (threshold is strict)', () => {
    expect(rule.apply(makeContext({ quantity: 100, runningTotalCents: 150_000 }))).toBeNull();
  });

  it('returns null below the threshold', () => {
    expect(rule.apply(makeContext({ quantity: 1, runningTotalCents: 1500 }))).toBeNull();
  });

  it('takes 20% off the running total at 101 units', () => {
    expect(rule.apply(makeContext({ quantity: 101, runningTotalCents: 151_500 }))).toEqual({
      label: 'Volume discount (20%)',
      amountCents: -30_300,
      type: 'discount',
    });
  });

  it('applies to the running total, not quantity x price', () => {
    const item = rule.apply(
      makeContext({ quantity: 150, unitPriceCents: 1500, runningTotalCents: 10_000 }),
    );
    expect(item?.amountCents).toBe(-2000);
  });
});
