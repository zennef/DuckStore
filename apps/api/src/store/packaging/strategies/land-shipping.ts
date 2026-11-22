import { PackageMaterial, Protection, ShippingMode } from '../packaging.enums';
import { ShippingStrategy } from '../shipping-strategy';

export class LandShipping implements ShippingStrategy {
  static readonly COST_PER_UNIT_CENTS = 1000;

  readonly mode = ShippingMode.LAND;

  getProtection(_material: PackageMaterial): Protection[] {
    return [Protection.POLYSTYRENE_BALLS];
  }

  getShippingCost(quantity: number): number {
    return quantity * LandShipping.COST_PER_UNIT_CENTS;
  }
}
