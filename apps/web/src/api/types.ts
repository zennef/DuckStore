/** Mirrors the API's Prisma enums. Order matches the spec, so selects list them the same way. */
export const COLORS = ['Red', 'Green', 'Yellow', 'Black'] as const;
export const SIZES = ['XLarge', 'Large', 'Medium', 'Small', 'XSmall'] as const;

export type Color = (typeof COLORS)[number];
export type Size = (typeof SIZES)[number];

/** A duck as the API returns it. The list only contains non-deleted ducks. */
export interface Duck {
  id: number;
  color: Color;
  size: Size;
  price: number;
  quantity: number;
  deleted: boolean;
}

/** POST and PATCH both answer with this. `merged` means the write landed on another duck. */
export interface DuckWriteResult {
  duck: Duck;
  merged: boolean;
}

export interface CreateDuckInput {
  color: Color;
  size: Size;
  price: number;
  quantity: number;
}

/** Only price and quantity are editable, and only the changed ones are sent. */
export type UpdateDuckInput = Partial<Pick<Duck, 'price' | 'quantity'>>;
