import { percentOf } from '../money';
import { LineItem, PricingContext, PricingRule } from '../pricing.types';

/** Spec 2.4.2: more than 100 units (101+) takes 20% off the running total. */
export class VolumeDiscountRule implements PricingRule {
  static readonly THRESHOLD = 100;
  static readonly PERCENT = 20;

  apply(ctx: PricingContext): LineItem | null {
    if (ctx.quantity <= VolumeDiscountRule.THRESHOLD) {
      return null;
    }
    return {
      label: `Volume discount (${VolumeDiscountRule.PERCENT}%)`,
      amountCents: -percentOf(ctx.runningTotalCents, VolumeDiscountRule.PERCENT),
      type: 'discount',
    };
  }
}
