import { LineItem } from '../../line-item';
import { ShippingMode } from '../../packaging/packaging.enums';
import { ShippingStrategy } from '../../packaging/shipping-strategy';
import { AirShipping } from '../../packaging/strategies/air-shipping';
import { makeContext } from '../pricing-context.fixture';
import { ShippingCostRule } from './shipping-cost.rule';

describe('ShippingCostRule', () => {
  const rule = new ShippingCostRule();

  it('returns the strategy line items unchanged and does no math of its own', () => {
    const lines: LineItem[] = [
      { label: 'Stub shipping', amountCents: 12_345, type: 'charge' },
      { label: 'Stub discount', amountCents: -345, type: 'discount' },
    ];
    const strategy: ShippingStrategy = {
      mode: ShippingMode.LAND,
      getProtection: () => [],
      getShippingLineItems: jest.fn().mockReturnValue(lines),
    };

    const items = rule.apply(makeContext({ quantity: 7, shipping: strategy, runningTotalCents: 999_999 }));

    expect(strategy.getShippingLineItems).toHaveBeenCalledWith(7);
    expect(items).toEqual(lines);
  });

  it('is not affected by the running total (shipping is never taxed or discounted)', () => {
    const a = rule.apply(makeContext({ quantity: 150, runningTotalCents: 1 }));
    const b = rule.apply(makeContext({ quantity: 150, runningTotalCents: 10_000_000 }));
    expect(a).toEqual(b);
  });

  it('passes through the Air charge and bulk discount lines from AirShipping', () => {
    expect(rule.apply(makeContext({ quantity: 1001, shipping: new AirShipping() }))).toEqual([
      { label: 'Air shipping (1001 x $30)', amountCents: 3_003_000, type: 'charge' },
      { label: 'Air bulk discount (15%)', amountCents: -450_450, type: 'discount' },
    ]);
  });
});
