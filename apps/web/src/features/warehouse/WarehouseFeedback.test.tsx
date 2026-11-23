import { screen, waitFor, within } from '@testing-library/react';
import { duckById, MOCKUP_DUCKS } from '../../test/ducks';
import { callCount, mockFetch } from '../../test/fetch';
import { renderWithProviders } from '../../test/render';
import { WarehousePage } from './WarehousePage';

const yellow6 = duckById(6); // Yellow, XLarge, $25.00, 5000
const black4 = duckById(4); // Black, Medium, $15.00, 950
const yellow3 = duckById(3); // Yellow, Medium, $15.00, 800

/** The toasts live region, so assertions can't accidentally match table or dialog text. */
function toasts() {
  const region = document.querySelector<HTMLElement>('[aria-live="polite"]');
  if (!region) throw new Error('No toast region');
  return within(region);
}

async function renderPage() {
  const view = renderWithProviders(<WarehousePage />);
  await screen.findByRole('table');
  return view;
}

async function fillAdd(
  user: ReturnType<typeof renderWithProviders>['user'],
  values: { color: string; size: string; price: string; quantity: string },
) {
  await user.click(screen.getAllByRole('button', { name: 'Add Duck' })[0]);
  const dialog = screen.getByRole('dialog', { name: 'Add Duck' });
  await user.selectOptions(within(dialog).getByLabelText('Color'), values.color);
  await user.selectOptions(within(dialog).getByLabelText('Size'), values.size);
  await user.type(within(dialog).getByLabelText('Price (USD)'), values.price);
  await user.type(within(dialog).getByLabelText('Quantity'), values.quantity);
  await user.click(within(dialog).getByRole('button', { name: 'Add Duck' }));
}

async function editQuantity(
  user: ReturnType<typeof renderWithProviders>['user'],
  id: number,
  quantity: string,
) {
  await user.click(screen.getByRole('button', { name: `Edit duck #${id}` }));
  const dialog = screen.getByRole('dialog', { name: `Edit duck #${id}` });
  await user.clear(within(dialog).getByLabelText('Quantity'));
  await user.type(within(dialog).getByLabelText('Quantity'), quantity);
  await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
}

describe('Warehouse feedback', () => {
  it('says plainly when an add merged into an existing duck', async () => {
    mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'POST /api/ducks': {
        status: 200,
        body: { duck: { ...yellow6, quantity: 5050 }, merged: true },
      },
    });
    const { user } = await renderPage();

    await fillAdd(user, { color: 'Yellow', size: 'XLarge', price: '25', quantity: '50' });

    expect(
      await toasts().findByText('Added 50 to existing duck #6 (Yellow, XLarge).'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms a plain add and refetches the list', async () => {
    const fetchMock = mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'POST /api/ducks': {
        status: 201,
        body: {
          duck: { id: 8, color: 'Red', size: 'Medium', price: 12, quantity: 5, deleted: false },
          merged: false,
        },
      },
    });
    const { user } = await renderPage();

    await fillAdd(user, { color: 'Red', size: 'Medium', price: '12', quantity: '5' });

    expect(await toasts().findByText('Duck #8 added.')).toBeInTheDocument();
    await waitFor(() => expect(callCount(fetchMock, 'GET /api/ducks')).toBe(2));
  });

  it('confirms a plain edit', async () => {
    mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'PATCH /api/ducks/4': { status: 200, body: { duck: { ...black4, quantity: 900 }, merged: false } },
    });
    const { user } = await renderPage();

    await editQuantity(user, 4, '900');

    expect(await toasts().findByText('Duck #4 updated.')).toBeInTheDocument();
  });

  it('says plainly when an edit merged the duck into another', async () => {
    mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'PATCH /api/ducks/4': {
        status: 200,
        body: { duck: { ...yellow3, quantity: 1700 }, merged: true },
      },
    });
    const { user } = await renderPage();

    await editQuantity(user, 4, '900');

    expect(
      await toasts().findByText(
        'Duck #4 now matches duck #3 (Yellow, Medium), so it was merged into it.',
      ),
    ).toBeInTheDocument();
  });

  it('confirms a delete', async () => {
    mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'DELETE /api/ducks/4': { status: 204 },
    });
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete duck #4' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await toasts().findByText('Duck #4 deleted.')).toBeInTheDocument();
  });

  it('on a 404 from an edit, closes the form, shows the server message and refetches', async () => {
    const fetchMock = mockFetch({
      'GET /api/ducks': [
        { status: 200, body: MOCKUP_DUCKS },
        { status: 200, body: MOCKUP_DUCKS.filter((d) => d.id !== 4) },
      ],
      'PATCH /api/ducks/4': {
        status: 404,
        body: { statusCode: 404, message: 'Duck 4 not found', error: 'Not Found' },
      },
    });
    const { user } = await renderPage();

    await editQuantity(user, 4, '10');

    expect(await toasts().findByText('Duck 4 not found')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Edit duck #4' })).not.toBeInTheDocument(),
    );
    expect(callCount(fetchMock, 'GET /api/ducks')).toBe(2);
  });

  it('on a 404 from a delete, closes the dialog, shows the message and refetches', async () => {
    const fetchMock = mockFetch({
      'GET /api/ducks': [
        { status: 200, body: MOCKUP_DUCKS },
        { status: 200, body: MOCKUP_DUCKS.filter((d) => d.id !== 4) },
      ],
      'DELETE /api/ducks/4': {
        status: 404,
        body: { statusCode: 404, message: 'Duck 4 not found', error: 'Not Found' },
      },
    });
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete duck #4' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await toasts().findByText('Duck 4 not found')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callCount(fetchMock, 'GET /api/ducks')).toBe(2);
  });

  it('on a 409 from an edit or delete, keeps the dialog open and shows no toast', async () => {
    const conflict = {
      status: 409,
      body: { statusCode: 409, message: 'Conflicting update, please retry', error: 'Conflict' },
    };
    const fetchMock = mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'PATCH /api/ducks/4': conflict,
      'DELETE /api/ducks/4': conflict,
    });
    const { user } = await renderPage();

    await editQuantity(user, 4, '10');
    const editDialog = screen.getByRole('dialog', { name: 'Edit duck #4' });
    expect(await within(editDialog).findByRole('alert')).toHaveTextContent(
      'Conflicting update, please retry',
    );
    await user.click(within(editDialog).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Delete duck #4' }));
    const deleteDialog = screen.getByRole('dialog');
    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete' }));
    expect(await within(deleteDialog).findByRole('alert')).toHaveTextContent(
      'Conflicting update, please retry',
    );

    expect(toasts().queryByText('Conflicting update, please retry')).not.toBeInTheDocument();
    // Both conflicts still refetched the list, since the duck may have changed.
    await waitFor(() => expect(callCount(fetchMock, 'GET /api/ducks')).toBe(3));
  });

  it('lets the user dismiss a toast', async () => {
    mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'DELETE /api/ducks/4': { status: 204 },
    });
    const { user } = await renderPage();

    await user.click(screen.getByRole('button', { name: 'Delete duck #4' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await toasts().findByText('Duck #4 deleted.');

    await user.click(toasts().getByRole('button', { name: 'Dismiss notification' }));
    expect(toasts().queryByText('Duck #4 deleted.')).not.toBeInTheDocument();
  });
});
