import type { Duck } from '../../api/types';
import { PencilIcon, TrashIcon } from '../../components/icons';
import { formatPrice, formatQuantity } from './format';

interface DuckTableProps {
  ducks: Duck[];
  onEdit: (duck: Duck) => void;
  onDelete: (duck: Duck) => void;
}

const th = 'px-4 py-3 text-left text-xs font-medium text-gray-600';
const td = 'px-4 py-4 text-sm';

/** Rows render in the order the API returns them: it sorts by quantity, descending. */
export function DuckTable({ ducks, onEdit, onDelete }: DuckTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200">
      <table className="w-full min-w-[640px] border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className={th}>ID</th>
            <th scope="col" className={th}>Color</th>
            <th scope="col" className={th}>Size</th>
            <th scope="col" className={`${th} text-center`}>Price (USD)</th>
            <th scope="col" className={`${th} text-center`}>Quantity</th>
            <th scope="col" className={th}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ducks.map((duck) => (
            <tr key={duck.id}>
              <td className={td}>{duck.id}</td>
              <td className={td}>{duck.color}</td>
              <td className={td}>{duck.size}</td>
              <td className={`${td} text-center tabular-nums`}>{formatPrice(duck.price)}</td>
              <td className={`${td} text-center tabular-nums`}>{formatQuantity(duck.quantity)}</td>
              <td className={td}>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => onEdit(duck)}
                    aria-label={`Edit duck #${duck.id}`}
                    className="inline-flex items-center gap-1 rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    <PencilIcon width={14} height={14} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(duck)}
                    aria-label={`Delete duck #${duck.id}`}
                    className="inline-flex items-center gap-1 rounded text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-red-600"
                  >
                    <TrashIcon width={14} height={14} />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
