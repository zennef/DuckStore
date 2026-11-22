import { PackageMaterial, Protection, ShippingMode } from '../packaging.enums';
import { ShippingStrategy } from '../shipping-strategy';

export class SeaShipping implements ShippingStrategy {
  static readonly FLAT_COST_CENTS = 40000;

  readonly mode = ShippingMode.SEA;

  getProtection(_material: PackageMaterial): Protection[] {
    return [Protection.MOISTURE_BEADS, Protection.BUBBLE_WRAP];
  }

  getShippingCost(_quantity: number): number {
    return SeaShipping.FLAT_COST_CENTS;
  }
}
