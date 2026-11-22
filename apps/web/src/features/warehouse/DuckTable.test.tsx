import { screen, within } from '@testing-library/react';
import { deferred, mockFetch, type Reply } from '../../test/fetch';
import { MOCKUP_DUCKS } from '../../test/ducks';
import { renderWithProviders } from '../../test/render';
import { WarehousePage } from './WarehousePage';

function bodyRows() {
  const [, ...rows] = screen.getAllByRole('row');
  return rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));
}

describe('Duck inventory table', () => {
  it('renders the API rows in order with formatted price and quantity', async () => {
    mockFetch({ 'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS } });
    renderWithProviders(<WarehousePage />);

    await screen.findByRole('table');
    expect(
      screen.getAllByRole('columnheader').map((th) => th.textContent),
    ).toEqual(['ID', 'Color', 'Size', 'Price (USD)', 'Quantity', 'Actions']);

    const rows = bodyRows();
    expect(rows.map((cells) => cells[0])).toEqual(['6', '2', '1', '4', '3', '5', '7']);
    expect(rows[0]).toEqual(['6', 'Yellow', 'XLarge', '$25.00', '5,000', 'EditDelete']);
    expect(rows[3].slice(3, 5)).toEqual(['$15.00', '950']);
    expect(screen.getByRole('button', { name: 'Edit duck #6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete duck #7' })).toBeInTheDocument();
  });

  it('formats cents and large quantities', async () => {
    mockFetch({
      'GET /api/ducks': {
        status: 200,
        body: [{ id: 9, color: 'Red', size: 'Small', price: 12.5, quantity: 1234567, deleted: false }],
      },
    });
    renderWithProviders(<WarehousePage />);

    await screen.findByRole('table');
    expect(bodyRows()[0].slice(3, 5)).toEqual(['$12.50', '1,234,567']);
  });

  it('shows a loading state until the list arrives', async () => {
    const reply = deferred<Reply>();
    mockFetch({ 'GET /api/ducks': () => reply.promise });
    renderWithProviders(<WarehousePage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading ducks...');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    reply.resolve({ status: 200, body: MOCKUP_DUCKS });
    await screen.findByRole('table');
    expect(screen.queryByText('Loading ducks...')).not.toBeInTheDocument();
  });

  it('shows an empty state with an Add Duck action', async () => {
    mockFetch({ 'GET /api/ducks': { status: 200, body: [] } });
    renderWithProviders(<WarehousePage />);

    expect(await screen.findByText('No ducks yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // One in the page header, one in the empty state.
    expect(screen.getAllByRole('button', { name: 'Add Duck' })).toHaveLength(2);
  });

  it('shows the error message and recovers on Retry', async () => {
    mockFetch({
      'GET /api/ducks': [
        { status: 500, body: { statusCode: 500, message: 'Internal server error' } },
        { status: 200, body: MOCKUP_DUCKS },
      ],
    });
    const { user } = renderWithProviders(<WarehousePage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load ducks.');
    expect(alert).toHaveTextContent('Internal server error');

    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await screen.findByRole('table');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
