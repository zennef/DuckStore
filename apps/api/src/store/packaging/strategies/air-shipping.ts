import { LineItem } from '../../line-item';
import { percentOf } from '../../pricing/money';
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

  getShippingLineItems(quantity: number): LineItem[] {
    const chargeCents = quantity * AirShipping.COST_PER_UNIT_CENTS;
    const lines: LineItem[] = [
      {
        label: `Air shipping (${quantity} x $${AirShipping.COST_PER_UNIT_CENTS / 100})`,
        amountCents: chargeCents,
        type: 'charge',
      },
    ];

    if (quantity > AirShipping.BULK_THRESHOLD) {
      lines.push({
        label: `Air bulk discount (${AirShipping.BULK_DISCOUNT_PERCENT}%)`,
        amountCents: -percentOf(chargeCents, AirShipping.BULK_DISCOUNT_PERCENT),
        type: 'discount',
      });
    }

    return lines;
  }
}
