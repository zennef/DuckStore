import type { CreateDuckInput, Duck, DuckWriteResult } from '../../api/types';
import { describeDuck, formatQuantity } from './format';

/** Toast copy for warehouse actions. A merge always says so, since the row count changes. */

export function addedMessage({ duck, merged }: DuckWriteResult, sent: CreateDuckInput): string {
  return merged
    ? `Added ${formatQuantity(sent.quantity)} to existing ${describeDuck(duck)}.`
    : `Duck #${duck.id} added.`;
}

export function updatedMessage(edited: Duck, { duck, merged }: DuckWriteResult): string {
  return merged
    ? `Duck #${edited.id} now matches ${describeDuck(duck)}, so it was merged into it.`
    : `Duck #${duck.id} updated.`;
}

export function deletedMessage(duck: Duck): string {
  return `Duck #${duck.id} deleted.`;
}
