import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { StorePage } from './features/store/StorePage';
import { WarehousePage } from './features/warehouse/WarehousePage';

/** Providers around the routes. Tests render AppRoutes with their own providers instead. */
export function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/warehouse" replace />} />
        <Route path="warehouse" element={<WarehousePage />} />
        <Route path="store" element={<StorePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/warehouse" className="mt-2 inline-block text-sm text-blue-700 underline">
        Go to the warehouse
      </Link>
    </div>
  );
}
