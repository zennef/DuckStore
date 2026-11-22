import { percentOf } from '../money';
import { LineItem, PricingContext, PricingRule } from '../pricing.types';

interface CountryTax {
  name: string;
  percent: number;
}

/** Spec 2.4.6 to 2.4.9. Keys are normalized country codes (trimmed, upper case). */
const TAX_BY_COUNTRY: Record<string, CountryTax> = {
  USA: { name: 'USA', percent: 18 },
  BOLIVIA: { name: 'Bolivia', percent: 13 },
  INDIA: { name: 'India', percent: 19 },
};

const OTHER_COUNTRY_TAX: CountryTax = { name: 'Other country', percent: 15 };

export class CountryTaxRule implements PricingRule {
  static taxFor(country: string): CountryTax {
    return TAX_BY_COUNTRY[country.trim().toUpperCase()] ?? OTHER_COUNTRY_TAX;
  }

  /** Every country is taxed (unknown ones at the "other" rate), so this never returns null. */
  apply(ctx: PricingContext): LineItem {
    const tax = CountryTaxRule.taxFor(ctx.country);
    return {
      label: `${tax.name} tax (${tax.percent}%)`,
      amountCents: percentOf(ctx.runningTotalCents, tax.percent),
      type: 'charge',
    };
  }
}
