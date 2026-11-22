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

/** Other spellings that mean USA. Bolivia and India match their exact names only. */
const COUNTRY_ALIASES: Record<string, string> = {
  US: 'USA',
  'U.S.': 'USA',
  'UNITED STATES': 'USA',
  'UNITED STATES OF AMERICA': 'USA',
};

const OTHER_COUNTRY_TAX: CountryTax = { name: 'Other country', percent: 15 };

export class CountryTaxRule implements PricingRule {
  static taxFor(country: string): CountryTax {
    const normalized = country.trim().toUpperCase();
    const code = COUNTRY_ALIASES[normalized] ?? normalized;
    return TAX_BY_COUNTRY[code] ?? OTHER_COUNTRY_TAX;
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
