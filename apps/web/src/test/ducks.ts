import type { Duck } from '../api/types';

/** The mockup's inventory, already in the API's order (quantity descending). */
export const MOCKUP_DUCKS: Duck[] = [
  { id: 6, color: 'Yellow', size: 'XLarge', price: 25, quantity: 5000, deleted: false },
  { id: 2, color: 'Green', size: 'Large', price: 20, quantity: 2000, deleted: false },
  { id: 1, color: 'Red', size: 'Large', price: 20, quantity: 1800, deleted: false },
  { id: 4, color: 'Black', size: 'Medium', price: 15, quantity: 950, deleted: false },
  { id: 3, color: 'Yellow', size: 'Medium', price: 15, quantity: 800, deleted: false },
  { id: 5, color: 'Green', size: 'Small', price: 10, quantity: 600, deleted: false },
  { id: 7, color: 'Red', size: 'XSmall', price: 8, quantity: 300, deleted: false },
];

export function duckById(id: number): Duck {
  const duck = MOCKUP_DUCKS.find((d) => d.id === id);
  if (!duck) throw new Error(`No mockup duck ${id}`);
  return duck;
}
