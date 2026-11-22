import { PackageMaterial } from '../packaging/packaging.enums';
import { AirShipping } from '../packaging/strategies/air-shipping';
import { PricingContext } from './pricing.types';

/** Test-only: a PricingContext with sensible defaults, overridable per test. */
export function makeContext(overrides: Partial<PricingContext> = {}): PricingContext {
  return {
    quantity: 10,
    unitPriceCents: 1500,
    material: PackageMaterial.CARDBOARD,
    country: 'USA',
    shipping: new AirShipping(),
    runningTotalCents: 15000,
    ...overrides,
  };
}
