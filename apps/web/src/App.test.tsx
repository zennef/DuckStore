import { screen } from '@testing-library/react';
import { AppRoutes } from './App';
import { mockFetch } from './test/fetch';
import { renderWithProviders } from './test/render';

describe('AppRoutes', () => {
  beforeEach(() => {
    mockFetch({ 'GET /api/ducks': { status: 200, body: [] } });
  });

  it('redirects / to the warehouse and marks it active in the sidebar', () => {
    renderWithProviders(<AppRoutes />, { route: '/' });

    expect(screen.getByText('Duck Store Platform')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Duck Warehouse' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Warehouse' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Store' })).not.toHaveAttribute('aria-current');
  });

  it('shows the Store placeholder with its endpoints', () => {
    renderWithProviders(<AppRoutes />, { route: '/store' });

    expect(screen.getByText(/Store module is backend only/)).toBeInTheDocument();
    expect(screen.getByText('/api/store/orders')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Store' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a not found page for unknown routes', () => {
    renderWithProviders(<AppRoutes />, { route: '/nope' });

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
