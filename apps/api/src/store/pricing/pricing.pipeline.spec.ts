import { Size } from '@prisma/client';
import { PackageFactory } from '../packaging/package.factory';
import { ShippingMode } from '../packaging/packaging.enums';
import { ShippingStrategyRegistry } from '../packaging/shipping-strategy.registry';
import { toCents } from './money';
import { PricingInput, PricingPipeline } from './pricing.pipeline';
import { PricingContext, PricingRule } from './pricing.types';

const registry = new ShippingStrategyRegistry();
const pipeline = new PricingPipeline();

/** Builds pipeline input the way the order endpoint will: from size, mode and a dollar price. */
function order(
  quantity: number,
  size: Size,
  price: number,
  country: string,
  mode: ShippingMode,
): PricingInput {
  return {
    quantity,
    unitPriceCents: toCents(price),
    material: PackageFactory.forSize(size),
    country,
    shipping: registry.get(mode),
  };
}

const amounts = (input: PricingInput) => pipeline.run(input).lineItems.map((i) => i.amountCents);

describe('PricingPipeline', () => {
  describe('CLAUDE.md worked example', () => {
    it('150 Medium @ $15, USA, AIR = $6,602.76', () => {
      const result = pipeline.run(order(150, Size.Medium, 15, 'USA', ShippingMode.AIR));

      expect(result.lineItems).toEqual([
        { label: 'Base cost (150 x $15.00)', amountCents: 225_000, type: 'charge' },
        { label: 'Volume discount (20%)', amountCents: -45_000, type: 'discount' },
        { label: 'Cardboard discount (1%)', amountCents: -1_800, type: 'discount' },
        { label: 'USA tax (18%)', amountCents: 32_076, type: 'charge' },
        { label: 'Air shipping (150 x $30)', amountCents: 450_000, type: 'charge' },
      ]);
      expect(result.totalCents).toBe(660_276);
    });
  });

  describe('boundary worked examples', () => {
    it('100 Large @ $20, Bolivia, LAND: no volume discount = $3,373.00', () => {
      // 2000.00 + 5% wood 100.00 = 2100.00; +13% 273.00 = 2373.00; + land 1000.00
      expect(amounts(order(100, Size.Large, 20, 'Bolivia', ShippingMode.LAND))).toEqual([
        200_000, 10_000, 27_300, 100_000,
      ]);
      expect(
        pipeline.run(order(100, Size.Large, 20, 'Bolivia', ShippingMode.LAND)).totalCents,
      ).toBe(337_300);
    });

    it('101 Large @ $20, Bolivia, LAND: volume discount applies = $2,927.38', () => {
      // 2020.00 - 20% 404.00 = 1616.00; +5% 80.80 = 1696.80; +13% 220.584 -> 220.58 = 1917.38; + land 1010.00
      expect(amounts(order(101, Size.Large, 20, 'Bolivia', ShippingMode.LAND))).toEqual([
        202_000, -40_400, 8_080, 22_058, 101_000,
      ]);
      expect(
        pipeline.run(order(101, Size.Large, 20, 'Bolivia', ShippingMode.LAND)).totalCents,
      ).toBe(292_738);
    });

    it('1000 Small @ $10, India, AIR: no air discount = $40,472.00', () => {
      // 10000.00 - 20% = 8000.00; +10% plastic = 8800.00; +19% 1672.00 = 10472.00; + air 1000 x $30
      const result = pipeline.run(order(1000, Size.Small, 10, 'India', ShippingMode.AIR));
      expect(result.lineItems.map((i) => i.amountCents)).toEqual([
        1_000_000, -200_000, 80_000, 167_200, 3_000_000,
      ]);
      expect(result.lineItems.at(-1)?.label).toBe('Air shipping (1000 x $30)');
      expect(result.totalCents).toBe(4_047_200);
    });

    it('1001 Small @ $10, Mexico, AIR: 15% off air cost as its own line = $35,655.62', () => {
      // 10010.00 - 20% = 8008.00; +10% = 8808.80; +15% other 1321.32 = 10130.12; + air 30030.00; - 15% 4504.50
      const result = pipeline.run(order(1001, Size.Small, 10, 'Mexico', ShippingMode.AIR));
      expect(result.lineItems.map((i) => i.amountCents)).toEqual([
        1_001_000, -200_200, 80_080, 132_132, 3_003_000, -450_450,
      ]);
      expect(result.lineItems.slice(-2)).toEqual([
        { label: 'Air shipping (1001 x $30)', amountCents: 3_003_000, type: 'charge' },
        { label: 'Air bulk discount (15%)', amountCents: -450_450, type: 'discount' },
      ]);
      expect(result.totalCents).toBe(3_565_562);
    });

    it('50 XSmall @ $8, "usa", SEA: lower-case country still taxed at 18% = $919.20', () => {
      expect(amounts(order(50, Size.XSmall, 8, 'usa', ShippingMode.SEA))).toEqual([
        40_000, 4_000, 7_920, 40_000,
      ]);
      expect(pipeline.run(order(50, Size.XSmall, 8, 'usa', ShippingMode.SEA)).totalCents).toBe(
        91_920,
      );
    });
  });

  describe('invariants', () => {
    const sizes = Object.values(Size);
    const modes = Object.values(ShippingMode);
    const countries = ['USA', 'bolivia', 'India', 'Mexico', ' usa '];
    const quantities = [1, 7, 99, 100, 101, 999, 1000, 1001, 4321];
    const prices = [0.01, 0.29, 8, 12.34, 19.99, 25];

    const cases = sizes.flatMap((size) =>
      modes.flatMap((mode) =>
        countries.flatMap((country) =>
          quantities.flatMap((quantity) =>
            prices.map((price) => order(quantity, size, price, country, mode)),
          ),
        ),
      ),
    );

    it(`line items sum exactly to the total and are whole cents (${cases.length} orders)`, () => {
      for (const input of cases) {
        const { lineItems, totalCents } = pipeline.run(input);
        const sum = lineItems.reduce((acc, item) => acc + item.amountCents, 0);
        expect(sum).toBe(totalCents);
        for (const item of lineItems) {
          expect(Number.isInteger(item.amountCents)).toBe(true);
        }
      }
    });

    it('shipping lines are always last, exactly as the strategy produced them (never taxed)', () => {
      for (const input of cases) {
        const { lineItems } = pipeline.run(input);
        const shipping = input.shipping.getShippingLineItems(input.quantity);
        expect(lineItems.slice(-shipping.length)).toEqual(shipping);
      }
    });

    it('the Air bulk discount line appears only above 1000 units, right after the air charge', () => {
      for (const input of cases.filter((c) => c.shipping.mode === ShippingMode.AIR)) {
        const labels = pipeline.run(input).lineItems.map((i) => i.label);
        const hasDiscount = labels.includes('Air bulk discount (15%)');
        expect(hasDiscount).toBe(input.quantity > 1000);
        if (hasDiscount) {
          expect(labels.at(-2)).toMatch(/^Air shipping \(/);
          expect(labels.at(-1)).toBe('Air bulk discount (15%)');
        }
      }
    });

    it('changing the shipping mode changes only the shipping line', () => {
      const air = pipeline.run(order(150, Size.Medium, 15, 'USA', ShippingMode.AIR)).lineItems;
      const sea = pipeline.run(order(150, Size.Medium, 15, 'USA', ShippingMode.SEA)).lineItems;
      expect(sea.slice(0, -1)).toEqual(air.slice(0, -1));
      expect(sea.at(-1)?.amountCents).toBe(40_000);
    });
  });

  describe('mechanics', () => {
    it('passes each rule the running total from the rules before it and skips null results', () => {
      const seen: number[] = [];
      const record = (amountCents: number | null): PricingRule => ({
        apply(ctx: PricingContext) {
          seen.push(ctx.runningTotalCents);
          return amountCents === null ? null : { label: 'x', amountCents, type: 'charge' };
        },
      });

      const result = new PricingPipeline([record(100), record(null), record(-30), record(5)]).run(
        order(1, Size.Medium, 1, 'USA', ShippingMode.SEA),
      );

      expect(seen).toEqual([0, 100, 100, 70]);
      expect(result.lineItems).toHaveLength(3);
      expect(result.totalCents).toBe(75);
    });
  });
});
