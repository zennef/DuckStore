import { LineItem } from '../line-item';
import { PackageMaterial } from '../packaging/packaging.enums';
import { ShippingStrategy } from '../packaging/shipping-strategy';

export type { LineItem } from '../line-item';

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

export interface PricingRule {
  /**
   * Returns the rule's line item, several line items when one step has more than
   * one part (shipping plus its discount), or null when the rule does not apply.
   */
  apply(ctx: PricingContext): LineItem | LineItem[] | null;
}
