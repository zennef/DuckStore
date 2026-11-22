import { Size } from '@prisma/client';
import { PackageFactory } from './package.factory';
import { PackageMaterial } from './packaging.enums';

describe('PackageFactory.forSize', () => {
  it.each([
    [Size.XLarge, PackageMaterial.WOOD],
    [Size.Large, PackageMaterial.WOOD],
    [Size.Medium, PackageMaterial.CARDBOARD],
    [Size.Small, PackageMaterial.PLASTIC],
    [Size.XSmall, PackageMaterial.PLASTIC],
  ])('%s ducks ship in %s', (size, material) => {
    expect(PackageFactory.forSize(size)).toBe(material);
  });

  it('throws for an unknown size', () => {
    expect(() => PackageFactory.forSize('Huge' as Size)).toThrow('Huge');
  });
});
