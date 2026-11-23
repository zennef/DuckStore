const ENDPOINTS: { method: string; path: string; description: string }[] = [
  { method: 'GET', path: '/api/store/ducks', description: 'List ducks, sorted by quantity' },
  {
    method: 'POST',
    path: '/api/store/ducks',
    description: 'Add a duck, merging into a matching one',
  },
  { method: 'PATCH', path: '/api/store/ducks/:id', description: 'Update price or quantity' },
  { method: 'DELETE', path: '/api/store/ducks/:id', description: 'Soft-delete a duck' },
  {
    method: 'POST',
    path: '/api/store/orders',
    description: 'Place an order: packaging, itemized charges and total',
  },
];

/** The Store module is backend only, so this page just points at its API. */
export function StorePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Duck Store</h1>
      <p className="mt-1 text-sm text-gray-500">
        The Store module is backend only. It has no screens here, just these endpoints.
      </p>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Endpoints</h2>
        <ul className="mt-3 divide-y divide-gray-100">
          {ENDPOINTS.map(({ method, path, description }) => (
            <li key={`${method} ${path}`} className="flex flex-wrap items-baseline gap-x-3 py-2">
              <code className="w-16 shrink-0 text-xs font-semibold text-blue-700">{method}</code>
              <code className="text-sm">{path}</code>
              <span className="text-sm text-gray-500">{description}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
