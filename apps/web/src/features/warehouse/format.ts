import type { Duck } from '../../api/types';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const count = new Intl.NumberFormat('en-US');

/** 25 -> "$25.00" */
export function formatPrice(price: number): string {
  return usd.format(price);
}

/** 5000 -> "5,000" */
export function formatQuantity(quantity: number): string {
  return count.format(quantity);
}

/** "duck #4 (Black, Medium)", the way messages and dialogs name a duck. */
export function describeDuck(duck: Pick<Duck, 'id' | 'color' | 'size'>): string {
  return `duck #${duck.id} (${duck.color}, ${duck.size})`;
}
