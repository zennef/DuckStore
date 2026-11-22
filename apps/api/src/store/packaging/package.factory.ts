import { Size } from '@prisma/client';
import { PackageMaterial } from './packaging.enums';

/**
 * Factory: the rest of the order flow asks "what package does this size need?"
 * without knowing the size-to-material table. The table lives in one place,
 * so a new size or material is a one-line change here.
 */
const MATERIAL_BY_SIZE: Record<Size, PackageMaterial> = {
  [Size.XLarge]: PackageMaterial.WOOD,
  [Size.Large]: PackageMaterial.WOOD,
  [Size.Medium]: PackageMaterial.CARDBOARD,
  [Size.Small]: PackageMaterial.PLASTIC,
  [Size.XSmall]: PackageMaterial.PLASTIC,
};

export class PackageFactory {
  static forSize(size: Size): PackageMaterial {
    const material = MATERIAL_BY_SIZE[size];
    if (!material) {
      throw new Error(`No package material defined for size "${size}"`);
    }
    return material;
  }
}
