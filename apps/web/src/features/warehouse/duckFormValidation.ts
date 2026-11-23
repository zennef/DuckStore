/**
 * Client checks that mirror the API's DTOs, so most mistakes are caught before a request:
 * price > 0 with at most 2 decimals, quantity a whole number (1+ on create, 0+ on edit).
 */
export type Parsed = { value: number; error?: undefined } | { value?: undefined; error: string };

export function parsePrice(raw: string): Parsed {
  const text = raw.trim();
  if (text === '') return { error: 'Enter a price.' };
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(text)) {
    return { error: 'Enter the price as a number, like 12.50.' };
  }
  const value = Number(text);
  if (!(value > 0)) return { error: 'Price must be greater than 0.' };
  // Trailing zeros don't count: 12.500 is the number 12.5, which the API accepts.
  const decimals = (text.split('.')[1] ?? '').replace(/0+$/, '');
  if (decimals.length > 2) return { error: 'Price can have at most 2 decimal places.' };
  return { value };
}

export function parseQuantity(raw: string, min: 0 | 1): Parsed {
  const text = raw.trim();
  if (text === '') return { error: 'Enter a quantity.' };
  if (!/^-?\d+$/.test(text)) return { error: 'Quantity must be a whole number.' };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { error: 'Quantity is too large.' };
  if (value < min) {
    return { error: min === 1 ? 'Quantity must be at least 1.' : 'Quantity cannot be negative.' };
  }
  return { value };
}
