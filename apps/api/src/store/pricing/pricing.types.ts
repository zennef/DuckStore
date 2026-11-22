import { PackageMaterial } from '../packaging/packaging.enums';
import { ShippingStrategy } from '../packaging/shipping-strategy';

/** Everything a pricing rule may look at. All money is integer cents. */
export interface PricingContext {
  quantity: number;
  unitPriceCents: number;
  material: PackageMaterial;
  /** Destination country as sent by the client. Rules normalize it themselves. */
  country: string;
  shipping: ShippingStrategy;
  /** Sum of every line item produced by the rules that ran before this one. */
  runningTotalCents: number;
}

export interface LineItem {
  label: string;
  /** Signed integer cents: negative for discounts, positive for charges. */
  amountCents: number;
  type: 'discount' | 'charge';
}

export interface PricingRule {
  /** Returns the rule's line item, or null when the rule does not apply to this order. */
  apply(ctx: PricingContext): LineItem | null;
}
