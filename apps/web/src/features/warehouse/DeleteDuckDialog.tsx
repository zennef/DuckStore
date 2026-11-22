import { useState } from 'react';
import { ApiError } from '../../api/client';
import { useDeleteDuck } from '../../api/ducks';
import type { Duck } from '../../api/types';
import { Modal } from '../../components/Modal';
import { describeDuck } from './format';

interface DeleteDuckDialogProps {
  duck: Duck;
  onClose: () => void;
  onDeleted: (duck: Duck) => void;
  /** 404 or 409: someone else deleted or changed the duck first. */
  onStale: (error: ApiError) => void;
}

/** Confirms a delete. The API soft-deletes, so the record stays in history. */
export function DeleteDuckDialog({ duck, onClose, onDeleted, onStale }: DeleteDuckDialogProps) {
  const remove = useDeleteDuck();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    remove.mutate(duck.id, {
      onSuccess: () => onDeleted(duck),
      onError: (err) => {
        if (err instanceof ApiError && err.isStale) onStale(err);
        else setError(err.message);
      },
    });
  }

  return (
    <Modal title={`Delete ${describeDuck(duck)}?`} onClose={onClose} canClose={!remove.isPending}>
      <p className="mt-2 text-sm text-gray-600">
        It will no longer appear in the inventory. Its record is kept for history.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        {/* Cancel first and autofocused, so Enter right after opening never deletes. */}
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}
          disabled={remove.isPending}
          autoFocus
        >
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={confirm} disabled={remove.isPending}>
          {remove.isPending ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
