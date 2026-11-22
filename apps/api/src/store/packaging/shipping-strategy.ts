import { LineItem } from '../line-item';
import { PackageMaterial, Protection, ShippingMode } from './packaging.enums';

/**
 * Strategy: each shipping mode decides its own protection and its own cost.
 * Mode-specific rules (like Air's bulk discount) stay inside that mode's class,
 * and adding a mode means adding one class and registering it, not editing a switch.
 */
export interface ShippingStrategy {
  readonly mode: ShippingMode;
  getProtection(material: PackageMaterial): Protection[];
  /**
   * The shipping lines for an order, in integer cents: the charge first, then
   * any mode-specific discount as its own line. Never empty.
   */
  getShippingLineItems(quantity: number): LineItem[];
}
