import { makeContext } from '../pricing-context.fixture';
import { BaseCostRule } from './base-cost.rule';

describe('BaseCostRule', () => {
  const rule = new BaseCostRule();

  it('charges quantity x unit price', () => {
    const item = rule.apply(makeContext({ quantity: 150, unitPriceCents: 1500, runningTotalCents: 0 }));
    expect(item).toEqual({
      label: 'Base cost (150 x $15.00)',
      amountCents: 225_000,
      type: 'charge',
    });
  });

  it('handles prices with cents exactly', () => {
    const item = rule.apply(makeContext({ quantity: 3, unitPriceCents: 1234 }));
    expect(item.amountCents).toBe(3702);
    expect(item.label).toBe('Base cost (3 x $12.34)');
  });

  it('ignores the running total (it is the first rule)', () => {
    const item = rule.apply(makeContext({ quantity: 2, unitPriceCents: 500, runningTotalCents: 99_999 }));
    expect(item.amountCents).toBe(1000);
  });
});
