import { useState } from 'react';
import { useDucks } from '../../api/ducks';
import type { Duck } from '../../api/types';
import { PlusIcon } from '../../components/icons';
import { DeleteDuckDialog } from './DeleteDuckDialog';
import { DuckForm } from './DuckForm';
import { DuckTable } from './DuckTable';

type OpenDialog = { kind: 'add' } | { kind: 'edit'; duck: Duck } | { kind: 'delete'; duck: Duck };

export function WarehousePage() {
  const ducks = useDucks();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const close = () => setDialog(null);
  const openAdd = () => setDialog({ kind: 'add' });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Duck Warehouse</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your rubber duck inventory.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>
          <PlusIcon />
          Add Duck
        </button>
      </div>

      <section
        aria-labelledby="inventory-heading"
        className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 id="inventory-heading" className="mb-4 text-sm font-semibold">
          Duck Inventory
        </h2>

        {ducks.isPending ? (
          <p role="status" className="py-10 text-center text-sm text-gray-500">
            Loading ducks...
          </p>
        ) : ducks.isError ? (
          <div role="alert" className="py-10 text-center">
            <p className="text-sm font-medium text-red-700">Could not load ducks.</p>
            <p className="mt-1 text-sm text-gray-600">{ducks.error.message}</p>
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => void ducks.refetch()}
              disabled={ducks.isFetching}
            >
              {ducks.isFetching ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ) : ducks.data.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium">No ducks yet</p>
            <p className="mt-1 text-sm text-gray-500">Add a duck to start tracking inventory.</p>
            <button type="button" className="btn-primary mt-4" onClick={openAdd}>
              <PlusIcon />
              Add Duck
            </button>
          </div>
        ) : (
          <DuckTable
            ducks={ducks.data}
            onEdit={(duck) => setDialog({ kind: 'edit', duck })}
            onDelete={(duck) => setDialog({ kind: 'delete', duck })}
          />
        )}
      </section>

      {dialog?.kind === 'add' && <DuckForm mode="create" onClose={close} onSaved={close} />}
      {dialog?.kind === 'edit' && (
        <DuckForm mode="edit" duck={dialog.duck} onClose={close} onSaved={close} onStale={close} />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDuckDialog duck={dialog.duck} onClose={close} onDeleted={close} onStale={close} />
      )}
    </div>
  );
}
