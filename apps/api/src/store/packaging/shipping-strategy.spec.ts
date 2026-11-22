import { PackageMaterial, Protection, ShippingMode } from './packaging.enums';
import { ShippingStrategy } from './shipping-strategy';
import { ShippingStrategyRegistry } from './shipping-strategy.registry';
import { AirShipping } from './strategies/air-shipping';
import { LandShipping } from './strategies/land-shipping';
import { SeaShipping } from './strategies/sea-shipping';

const { WOOD, CARDBOARD, PLASTIC } = PackageMaterial;
const { POLYSTYRENE_BALLS, BUBBLE_WRAP, MOISTURE_BEADS } = Protection;

describe('Shipping strategies', () => {
  const registry = new ShippingStrategyRegistry();

  describe('protection for every material x mode', () => {
    it.each([
      [ShippingMode.AIR, WOOD, [POLYSTYRENE_BALLS]],
      [ShippingMode.AIR, CARDBOARD, [POLYSTYRENE_BALLS]],
      [ShippingMode.AIR, PLASTIC, [BUBBLE_WRAP]],
      [ShippingMode.LAND, WOOD, [POLYSTYRENE_BALLS]],
      [ShippingMode.LAND, CARDBOARD, [POLYSTYRENE_BALLS]],
      [ShippingMode.LAND, PLASTIC, [POLYSTYRENE_BALLS]],
      [ShippingMode.SEA, WOOD, [MOISTURE_BEADS, BUBBLE_WRAP]],
      [ShippingMode.SEA, CARDBOARD, [MOISTURE_BEADS, BUBBLE_WRAP]],
      [ShippingMode.SEA, PLASTIC, [MOISTURE_BEADS, BUBBLE_WRAP]],
    ])('%s + %s -> %j', (mode, material, expected) => {
      expect(registry.get(mode).getProtection(material)).toEqual(expected);
    });
  });

  describe('shipping line items (integer cents)', () => {
    it('Sea is a single flat $400 charge regardless of quantity', () => {
      const sea = new SeaShipping();
      const expected = [{ label: 'Sea shipping (flat $400)', amountCents: 40_000, type: 'charge' }];
      expect(sea.getShippingLineItems(1)).toEqual(expected);
      expect(sea.getShippingLineItems(5000)).toEqual(expected);
    });

    it.each([
      [1, 1_000],
      [150, 150_000],
      [2000, 2_000_000],
    ])('Land is $10 per unit: %i units -> %i cents', (quantity, amountCents) => {
      expect(new LandShipping().getShippingLineItems(quantity)).toEqual([
        { label: `Land shipping (${quantity} x $10)`, amountCents, type: 'charge' },
      ]);
    });

    it('Air is a single $30 per unit charge', () => {
      expect(new AirShipping().getShippingLineItems(150)).toEqual([
        { label: 'Air shipping (150 x $30)', amountCents: 450_000, type: 'charge' },
      ]);
    });

    it('Air at exactly 1000 units has no bulk discount line', () => {
      expect(new AirShipping().getShippingLineItems(1000)).toEqual([
        { label: 'Air shipping (1000 x $30)', amountCents: 3_000_000, type: 'charge' },
      ]);
    });

    it('Air at 1001 units adds a separate 15% bulk discount line', () => {
      // 1001 x $30 = $30,030.00; 15% of that = $4,504.50; net $25,525.50
      expect(new AirShipping().getShippingLineItems(1001)).toEqual([
        { label: 'Air shipping (1001 x $30)', amountCents: 3_003_000, type: 'charge' },
        { label: 'Air bulk discount (15%)', amountCents: -450_450, type: 'discount' },
      ]);
    });

    it('Air bulk discount is 15% of the full air charge ($4.50 per unit, so always whole cents)', () => {
      // It goes through percentOf (half-up), but at $30/unit there is never a remainder to round.
      for (const quantity of [1001, 1111, 4321, 99_999]) {
        const [charge, discount] = new AirShipping().getShippingLineItems(quantity);
        expect(discount.amountCents).toBe(-quantity * 450);
        expect(charge.amountCents + discount.amountCents).toBe(quantity * 2550);
      }
    });
  });

  describe('ShippingStrategyRegistry', () => {
    it.each([ShippingMode.AIR, ShippingMode.LAND, ShippingMode.SEA])(
      'returns the %s strategy',
      (mode) => {
        expect(registry.get(mode).mode).toBe(mode);
      },
    );

    it('throws for a mode with no registered strategy', () => {
      const airOnly = new ShippingStrategyRegistry([new AirShipping()]);
      expect(() => airOnly.get(ShippingMode.SEA)).toThrow('SEA');
    });

    it('accepts custom strategies, so a new mode is added by registering a class', () => {
      const custom: ShippingStrategy = {
        mode: ShippingMode.LAND,
        getProtection: () => [],
        getShippingLineItems: () => [{ label: 'Custom', amountCents: 1, type: 'charge' }],
      };
      expect(new ShippingStrategyRegistry([custom]).get(ShippingMode.LAND)).toBe(custom);
    });
  });
});
