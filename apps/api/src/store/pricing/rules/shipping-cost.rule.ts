import { LineItem, PricingContext, PricingRule } from '../pricing.types';

/**
 * Spec 2.4.10 to 2.4.12. Delegates entirely to the shipping strategy: amount and
 * label both come from it, and this rule does no shipping math of its own.
 * Must run last so the percentage rules never apply to shipping.
 */
export class ShippingCostRule implements PricingRule {
  apply(ctx: PricingContext): LineItem {
    return {
      label: ctx.shipping.getShippingLabel(ctx.quantity),
      amountCents: ctx.shipping.getShippingCost(ctx.quantity),
      type: 'charge',
    };
  }
}
