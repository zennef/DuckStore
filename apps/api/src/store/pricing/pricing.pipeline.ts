import { LineItem, PricingContext, PricingRule } from './pricing.types';
import { BaseCostRule } from './rules/base-cost.rule';
import { CountryTaxRule } from './rules/country-tax.rule';
import { PackageAdjustmentRule } from './rules/package-adjustment.rule';
import { ShippingCostRule } from './rules/shipping-cost.rule';
import { VolumeDiscountRule } from './rules/volume-discount.rule';

export type PricingInput = Omit<PricingContext, 'runningTotalCents'>;

export interface PricingResult {
  lineItems: LineItem[];
  /** Always exactly the sum of lineItems[].amountCents. */
  totalCents: number;
}

/**
 * Pipeline of rules: the spec's order total is a fixed sequence of steps where
 * each percentage applies to the total so far. Modeling each step as a small
 * rule run in order makes that compounding explicit, gives every step its own
 * line item for the response, and lets each rule be tested on its own.
 * Order matters: shipping runs last so no percentage ever applies to it.
 */
export class PricingPipeline {
  static defaultRules(): PricingRule[] {
    return [
      new BaseCostRule(),
      new VolumeDiscountRule(),
      new PackageAdjustmentRule(),
      new CountryTaxRule(),
      new ShippingCostRule(),
    ];
  }

  constructor(private readonly rules: readonly PricingRule[] = PricingPipeline.defaultRules()) {}

  run(input: PricingInput): PricingResult {
    const lineItems: LineItem[] = [];
    let runningTotalCents = 0;

    for (const rule of this.rules) {
      const item = rule.apply({ ...input, runningTotalCents });
      if (item) {
        lineItems.push(item);
        runningTotalCents += item.amountCents;
      }
    }

    return { lineItems, totalCents: runningTotalCents };
  }
}
