import { PackageMaterial } from '../../packaging/packaging.enums';
import { makeContext } from '../pricing-context.fixture';
import { PackageAdjustmentRule } from './package-adjustment.rule';

describe('PackageAdjustmentRule', () => {
  const rule = new PackageAdjustmentRule();

  it('adds 5% for wood', () => {
    expect(rule.apply(makeContext({ material: PackageMaterial.WOOD, runningTotalCents: 200_000 }))).toEqual({
      label: 'Wood packaging (5%)',
      amountCents: 10_000,
      type: 'charge',
    });
  });

  it('adds 10% for plastic', () => {
    expect(rule.apply(makeContext({ material: PackageMaterial.PLASTIC, runningTotalCents: 800_000 }))).toEqual({
      label: 'Plastic packaging (10%)',
      amountCents: 80_000,
      type: 'charge',
    });
  });

  it('takes 1% off for cardboard', () => {
    expect(rule.apply(makeContext({ material: PackageMaterial.CARDBOARD, runningTotalCents: 180_000 }))).toEqual({
      label: 'Cardboard discount (1%)',
      amountCents: -1800,
      type: 'discount',
    });
  });

  it('rounds a half-cent cardboard discount away from zero', () => {
    // 1% of $12,345.50 = $123.455 -> -$123.46
    const item = rule.apply(makeContext({ material: PackageMaterial.CARDBOARD, runningTotalCents: 1_234_550 }));
    expect(item?.amountCents).toBe(-12_346);
  });

  it('returns null for a material with no adjustment', () => {
    expect(rule.apply(makeContext({ material: 'GLASS' as PackageMaterial }))).toBeNull();
  });
});
