import { PlusIcon } from '../../components/icons';

export function WarehousePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Duck Warehouse</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your rubber duck inventory.</p>
        </div>
        <button type="button" className="btn-primary">
          <PlusIcon />
          Add Duck
        </button>
      </div>

      <section
        aria-labelledby="inventory-heading"
        className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 id="inventory-heading" className="text-sm font-semibold">
          Duck Inventory
        </h2>
      </section>
    </div>
  );
}
