import { PackageMaterial } from '../../packaging/packaging.enums';
import { percentOf } from '../money';
import { LineItem, PricingContext, PricingRule } from '../pricing.types';

interface Adjustment {
  /** Positive adds to the total, negative is a discount. */
  percent: number;
  label: string;
}

/** Spec 2.4.3 to 2.4.5: wood +5%, plastic +10%, cardboard -1% of the running total. */
const ADJUSTMENTS: Partial<Record<PackageMaterial, Adjustment>> = {
  [PackageMaterial.WOOD]: { percent: 5, label: 'Wood packaging (5%)' },
  [PackageMaterial.PLASTIC]: { percent: 10, label: 'Plastic packaging (10%)' },
  [PackageMaterial.CARDBOARD]: { percent: -1, label: 'Cardboard discount (1%)' },
};

export class PackageAdjustmentRule implements PricingRule {
  apply(ctx: PricingContext): LineItem | null {
    const adjustment = ADJUSTMENTS[ctx.material];
    if (!adjustment) {
      return null;
    }
    return {
      label: adjustment.label,
      amountCents: percentOf(ctx.runningTotalCents, adjustment.percent),
      type: adjustment.percent < 0 ? 'discount' : 'charge',
    };
  }
}
