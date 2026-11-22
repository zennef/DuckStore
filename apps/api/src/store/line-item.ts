/** One line of an order's cost breakdown. Shared by pricing rules and shipping strategies. */
export interface LineItem {
  label: string;
  /** Signed integer cents: negative for discounts, positive for charges. */
  amountCents: number;
  type: 'discount' | 'charge';
}
