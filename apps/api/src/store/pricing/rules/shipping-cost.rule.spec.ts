import { ShippingMode } from '../../packaging/packaging.enums';
import { ShippingStrategy } from '../../packaging/shipping-strategy';
import { AirShipping } from '../../packaging/strategies/air-shipping';
import { makeContext } from '../pricing-context.fixture';
import { ShippingCostRule } from './shipping-cost.rule';

describe('ShippingCostRule', () => {
  const rule = new ShippingCostRule();

  it('takes amount and label from the strategy and does no math of its own', () => {
    const strategy: ShippingStrategy = {
      mode: ShippingMode.LAND,
      getProtection: () => [],
      getShippingCost: jest.fn().mockReturnValue(12_345),
      getShippingLabel: jest.fn().mockReturnValue('Stub shipping'),
    };

    const item = rule.apply(makeContext({ quantity: 7, shipping: strategy, runningTotalCents: 999_999 }));

    expect(strategy.getShippingCost).toHaveBeenCalledWith(7);
    expect(strategy.getShippingLabel).toHaveBeenCalledWith(7);
    expect(item).toEqual({ label: 'Stub shipping', amountCents: 12_345, type: 'charge' });
  });

  it('is not affected by the running total (shipping is never taxed or discounted)', () => {
    const a = rule.apply(makeContext({ quantity: 150, runningTotalCents: 1 }));
    const b = rule.apply(makeContext({ quantity: 150, runningTotalCents: 10_000_000 }));
    expect(a).toEqual(b);
  });

  it('passes through the Air bulk discount computed by AirShipping', () => {
    const item = rule.apply(makeContext({ quantity: 1001, shipping: new AirShipping() }));
    expect(item).toEqual({
      label: 'Air shipping (1001 x $30, 15% bulk discount)',
      amountCents: 2_552_550,
      type: 'charge',
    });
  });
});
