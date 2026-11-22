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

  describe('shipping cost (integer cents)', () => {
    it('Sea is a flat $400 regardless of quantity', () => {
      const sea = new SeaShipping();
      expect(sea.getShippingCost(1)).toBe(40_000);
      expect(sea.getShippingCost(5000)).toBe(40_000);
    });

    it('Land is $10 per unit', () => {
      const land = new LandShipping();
      expect(land.getShippingCost(1)).toBe(1_000);
      expect(land.getShippingCost(150)).toBe(150_000);
      expect(land.getShippingCost(2000)).toBe(2_000_000);
    });

    it('Air is $30 per unit', () => {
      expect(new AirShipping().getShippingCost(150)).toBe(450_000);
    });

    it('Air at exactly 1000 units gets no bulk discount', () => {
      expect(new AirShipping().getShippingCost(1000)).toBe(3_000_000);
    });

    it('Air at 1001 units takes 15% off the air cost', () => {
      // 1001 x $30 = $30,030.00, minus 15% = $25,525.50
      expect(new AirShipping().getShippingCost(1001)).toBe(2_552_550);
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
        getShippingCost: () => 1,
      };
      expect(new ShippingStrategyRegistry([custom]).get(ShippingMode.LAND)).toBe(custom);
    });
  });
});
