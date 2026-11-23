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

  describe('USA aliases', () => {
    it.each([
      'US',
      'U.S.',
      'U.S.A.',
      'USA.',
      'United States',
      'United States of America',
      // case-insensitive, after trimming
      'us',
      ' u.s. ',
      'usa.',
      ' u.s.a. ',
      'UNITED STATES',
      '  united states of america  ',
    ])('"%s" is taxed as USA at 18%%', (country) => {
      expect(rule.apply(makeContext({ country, runningTotalCents }))).toEqual({
        label: 'USA tax (18%)',
        amountCents: 32_076,
        type: 'charge',
      });
    });

    it.each(['America', 'U S', 'United States of Mexico'])(
      '"%s" is not a listed alias, so it is an other country (15%%)',
      (country) => {
        expect(CountryTaxRule.taxFor(country)).toEqual({ name: 'Other country', percent: 15 });
      },
    );
  });

  it.each(['Plurinational State of Bolivia', 'Republic of India', 'Bharat', 'BO', 'IN'])(
    'Bolivia and India match exact names only: "%s" is an other country',
    (country) => {
      expect(CountryTaxRule.taxFor(country).percent).toBe(15);
    },
  );

  it('rounds tax half-up', () => {
    // 13% of $1.50 = $0.195 -> $0.20
    expect(
      rule.apply(makeContext({ country: 'Bolivia', runningTotalCents: 150 })).amountCents,
    ).toBe(20);
  });
});
