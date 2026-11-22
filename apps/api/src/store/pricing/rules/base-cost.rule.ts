import { formatUsd } from '../money';
import { LineItem, PricingContext, PricingRule } from '../pricing.types';

/** Spec 2.4.1: initial total is quantity x price. */
export class BaseCostRule implements PricingRule {
  apply(ctx: PricingContext): LineItem {
    return {
      label: `Base cost (${ctx.quantity} x ${formatUsd(ctx.unitPriceCents)})`,
      amountCents: ctx.quantity * ctx.unitPriceCents,
      type: 'charge',
    };
  }
}
