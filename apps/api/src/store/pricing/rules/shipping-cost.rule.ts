import { LineItem, PricingContext, PricingRule } from '../pricing.types';

/**
 * Spec 2.4.10 to 2.4.12. Delegates entirely to the shipping strategy, which
 * returns the shipping charge and any mode discount as line items. This rule
 * does no shipping math of its own. Must run last so the percentage rules
 * never apply to shipping.
 */
export class ShippingCostRule implements PricingRule {
  apply(ctx: PricingContext): LineItem[] {
    return ctx.shipping.getShippingLineItems(ctx.quantity);
  }
}
