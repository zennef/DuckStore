import { ShippingMode } from './packaging.enums';
import { ShippingStrategy } from './shipping-strategy';
import { AirShipping } from './strategies/air-shipping';
import { LandShipping } from './strategies/land-shipping';
import { SeaShipping } from './strategies/sea-shipping';

/** Looks up the strategy for a shipping mode. Backed by a map keyed by mode, so there is no switch to edit. */
export class ShippingStrategyRegistry {
  private readonly strategies: ReadonlyMap<ShippingMode, ShippingStrategy>;

  constructor(
    strategies: ShippingStrategy[] = [new AirShipping(), new LandShipping(), new SeaShipping()],
  ) {
    this.strategies = new Map(strategies.map((s) => [s.mode, s]));
  }

  get(mode: ShippingMode): ShippingStrategy {
    const strategy = this.strategies.get(mode);
    if (!strategy) {
      throw new Error(`No shipping strategy registered for mode "${mode}"`);
    }
    return strategy;
  }
}
