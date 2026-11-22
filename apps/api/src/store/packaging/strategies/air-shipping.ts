import { PackageMaterial, Protection, ShippingMode } from '../packaging.enums';
import { ShippingStrategy } from '../shipping-strategy';

export class AirShipping implements ShippingStrategy {
  static readonly COST_PER_UNIT_CENTS = 3000;
  /** The discount applies when quantity is strictly greater than this. */
  static readonly BULK_THRESHOLD = 1000;
  static readonly BULK_DISCOUNT_PERCENT = 15;

  readonly mode = ShippingMode.AIR;

  getProtection(material: PackageMaterial): Protection[] {
    return material === PackageMaterial.PLASTIC
      ? [Protection.BUBBLE_WRAP]
      : [Protection.POLYSTYRENE_BALLS];
  }

  getShippingCost(quantity: number): number {
    const baseCents = quantity * AirShipping.COST_PER_UNIT_CENTS;
    if (quantity <= AirShipping.BULK_THRESHOLD) {
      return baseCents;
    }
    // Exact in integer cents: the per-unit rate is a multiple of 100, so 85% of it is whole.
    return (baseCents * (100 - AirShipping.BULK_DISCOUNT_PERCENT)) / 100;
  }

  getShippingLabel(quantity: number): string {
    const rate = `${quantity} x $${AirShipping.COST_PER_UNIT_CENTS / 100}`;
    return quantity > AirShipping.BULK_THRESHOLD
      ? `Air shipping (${rate}, ${AirShipping.BULK_DISCOUNT_PERCENT}% bulk discount)`
      : `Air shipping (${rate})`;
  }
}
