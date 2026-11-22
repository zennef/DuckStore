import { makeContext } from '../pricing-context.fixture';
import { CountryTaxRule } from './country-tax.rule';

describe('CountryTaxRule', () => {
  const rule = new CountryTaxRule();
  const runningTotalCents = 178_200;

  it.each([
    ['USA', 'USA tax (18%)', 32_076],
    ['Bolivia', 'Bolivia tax (13%)', 23_166],
    ['India', 'India tax (19%)', 33_858],
    ['Mexico', 'Other country tax (15%)', 26_730],
  ])('%s -> %s', (country, label, amountCents) => {
    expect(rule.apply(makeContext({ country, runningTotalCents }))).toEqual({
      label,
      amountCents,
      type: 'charge',
    });
  });

  it.each(['usa', 'Usa', ' USA ', 'bOLIVIA', 'india'])(
    'matches "%s" case-insensitively',
    (country) => {
      expect(CountryTaxRule.taxFor(country).name).not.toBe('Other country');
    },
  );

  it('treats aliases that are not the normalized code as other countries', () => {
    expect(CountryTaxRule.taxFor('United States').percent).toBe(15);
    expect(CountryTaxRule.taxFor('US').percent).toBe(15);
  });

  it('rounds tax half-up', () => {
    // 13% of $1.50 = $0.195 -> $0.20
    expect(rule.apply(makeContext({ country: 'Bolivia', runningTotalCents: 150 })).amountCents).toBe(20);
  });
});
