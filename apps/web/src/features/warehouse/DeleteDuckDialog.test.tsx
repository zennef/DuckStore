import { screen, waitFor, within } from '@testing-library/react';
import { MOCKUP_DUCKS } from '../../test/ducks';
import { callCount, mockFetch } from '../../test/fetch';
import { renderWithProviders } from '../../test/render';
import { WarehousePage } from './WarehousePage';

const withoutDuck4 = MOCKUP_DUCKS.filter((d) => d.id !== 4);

async function openDeleteFor4() {
  const view = renderWithProviders(<WarehousePage />);
  const trigger = await screen.findByRole('button', { name: 'Delete duck #4' });
  await view.user.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Delete duck #4 (Black, Medium)?' });
  return { ...view, dialog, trigger };
}

describe('Delete confirmation', () => {
  it('names the duck, focuses Cancel and styles Delete as destructive', async () => {
    mockFetch({ 'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS } });
    const { dialog } = await openDeleteFor4();

    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveClass('btn-danger');
  });

  it('deletes only after Delete is confirmed, then refetches the list', async () => {
    const fetchMock = mockFetch({
      'GET /api/ducks': [
        { status: 200, body: MOCKUP_DUCKS },
        { status: 200, body: withoutDuck4 },
      ],
      'DELETE /api/ducks/4': { status: 204 },
    });
    const { user, dialog } = await openDeleteFor4();
    expect(callCount(fetchMock, 'DELETE /api/ducks/4')).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callCount(fetchMock, 'DELETE /api/ducks/4')).toBe(1);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Delete duck #4' })).not.toBeInTheDocument(),
    );
    expect(callCount(fetchMock, 'GET /api/ducks')).toBe(2);
  });

  it('does nothing on Cancel and returns focus to the trigger', async () => {
    const fetchMock = mockFetch({ 'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS } });
    const { user, dialog, trigger } = await openDeleteFor4();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(callCount(fetchMock, 'DELETE /api/ducks/4')).toBe(0);
    expect(callCount(fetchMock, 'GET /api/ducks')).toBe(1);
  });

  it('does nothing on Esc', async () => {
    const fetchMock = mockFetch({ 'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS } });
    const { user } = await openDeleteFor4();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callCount(fetchMock, 'DELETE /api/ducks/4')).toBe(0);
  });

  it('keeps the dialog open with the message on an unexpected error', async () => {
    mockFetch({
      'GET /api/ducks': { status: 200, body: MOCKUP_DUCKS },
      'DELETE /api/ducks/4': {
        status: 500,
        body: { statusCode: 500, message: 'Internal server error' },
      },
    });
    const { user, dialog } = await openDeleteFor4();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Internal server error');
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('keeps the dialog open on a 409 so the user can retry', async () => {
    const fetchMock = mockFetch({
      'GET /api/ducks': [
        { status: 200, body: MOCKUP_DUCKS },
        { status: 200, body: MOCKUP_DUCKS },
        { status: 200, body: withoutDuck4 },
      ],
      'DELETE /api/ducks/4': [
        {
          status: 409,
          body: { statusCode: 409, message: 'Conflicting update, please retry', error: 'Conflict' },
        },
        { status: 204 },
      ],
    });
    const { user, dialog } = await openDeleteFor4();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Conflicting update, please retry',
    );
    expect(dialog).toHaveAttribute('open');

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(callCount(fetchMock, 'DELETE /api/ducks/4')).toBe(2);
  });
});
