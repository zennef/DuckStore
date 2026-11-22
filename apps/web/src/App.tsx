import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const queryClient = new QueryClient();

/** App shell with providers wired up. Layout and routes come with the warehouse feature. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <main data-testid="app-root" className="min-h-screen bg-gray-50" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
