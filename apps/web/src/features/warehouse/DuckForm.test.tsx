import { screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import type { DuckWriteResult } from '../../api/types';
import { duckById } from '../../test/ducks';
import { callCount, deferred, mockFetch, requestBodies, type Reply } from '../../test/fetch';
import { renderWithProviders } from '../../test/render';
import { DuckForm } from './DuckForm';

const black4 = duckById(4); // Black, Medium, $15.00, 950

function renderCreate() {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const view = renderWithProviders(<DuckForm mode="create" onSaved={onSaved} onClose={onClose} />);
  return { ...view, onSaved, onClose };
}

function renderEdit() {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const onNotFound = vi.fn();
  const view = renderWithProviders(
    <DuckForm
      mode="edit"
      duck={black4}
      onSaved={onSaved}
      onClose={onClose}
      onNotFound={onNotFound}
    />,
  );
  return { ...view, onSaved, onClose, onNotFound };
}

const field = (name: string) => screen.getByLabelText(name);

describe('DuckForm', () => {
  describe('create mode', () => {
    it('opens as a modal dialog with every field labelled and enabled', () => {
      mockFetch({});
      renderCreate();

      const dialog = screen.getByRole('dialog', { name: 'Add Duck' });
      expect(dialog).toHaveAttribute('open');
      for (const name of ['Color', 'Size', 'Price (USD)', 'Quantity']) {
        expect(within(dialog).getByLabelText(name)).toBeEnabled();
      }
      expect(field('Color')).toHaveValue('');
      expect(field('Size')).toHaveValue('');
    });

    it('validates every field before sending anything', async () => {
      const fetchMock = mockFetch({});
      const { user } = renderCreate();

      await user.click(screen.getByRole('button', { name: 'Add Duck' }));

      expect(screen.getByText('Choose a color.')).toBeInTheDocument();
      expect(screen.getByText('Choose a size.')).toBeInTheDocument();
      expect(screen.getByText('Enter a price.')).toBeInTheDocument();
      expect(screen.getByText('Enter a quantity.')).toBeInTheDocument();
      expect(field('Price (USD)')).toHaveAttribute('aria-invalid', 'true');
      expect(field('Price (USD)')).toHaveAccessibleDescription('Enter a price.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects quantity 0', async () => {
      const fetchMock = mockFetch({});
      const { user } = renderCreate();

      await user.selectOptions(field('Color'), 'Red');
      await user.selectOptions(field('Size'), 'Small');
      await user.type(field('Price (USD)'), '10');
      await user.type(field('Quantity'), '0');
      await user.click(screen.getByRole('button', { name: 'Add Duck' }));

      expect(screen.getByText('Quantity must be at least 1.')).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['12.345', 'Price can have at most 2 decimal places.'],
      ['0', 'Price must be greater than 0.'],
      ['-4', 'Price must be greater than 0.'],
      ['ten', 'Enter the price as a number, like 12.50.'],
    ])('rejects price %s', async (price, message) => {
      mockFetch({});
      const { user } = renderCreate();

      await user.type(field('Price (USD)'), price);
      await user.click(screen.getByRole('button', { name: 'Add Duck' }));

      expect(field('Price (USD)')).toHaveAccessibleDescription(message);
    });

    it.each(['12', '12.5', '12.50', '0.01', '12.500'])('accepts price %s', async (price) => {
      mockFetch({});
      const { user } = renderCreate();

      await user.type(field('Price (USD)'), price);
      await user.click(screen.getByRole('button', { name: 'Add Duck' }));

      expect(field('Price (USD)')).not.toHaveAttribute('aria-invalid');
    });

    it('rejects a fractional quantity', async () => {
      mockFetch({});
      const { user } = renderCreate();

      await user.type(field('Quantity'), '2.5');
      await user.click(screen.getByRole('button', { name: 'Add Duck' }));

      expect(field('Quantity')).toHaveAccessibleDescription('Quantity must be a whole number.');
    });

    it('posts all four fields and shows a pending state while saving', async () => {
      const reply = deferred<Reply>();
      const result: DuckWriteResult = {
        duck: { id: 8, color: 'Green', size: 'Medium', price: 12.5, quantity: 40, deleted: false },
        merged: false,
      };
      const fetchMock = mockFetch({ 'POST /api/ducks': () => reply.promise });
      const { user, onSaved } = renderCreate();

      await user.selectOptions(field('Color'), 'Green');
      await user.selectOptions(field('Size'), 'Medium');
      await user.type(field('Price (USD)'), '12.50');
      await user.type(field('Quantity'), '40');
      await user.click(screen.getByRole('button', { name: 'Add Duck' }));

      const saving = screen.getByRole('button', { name: 'Saving...' });
      expect(saving).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      await user.click(saving);
      expect(callCount(fetchMock, 'POST /api/ducks')).toBe(1);

      reply.resolve({ status: 201, body: result });
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(onSaved).toHaveBeenCalledWith(result, {
        color: 'Green',
        size: 'Medium',
        price: 12.5,
        quantity: 40,
      });
      expect(requestBodies(fetchMock, 'POST /api/ducks')).toEqual([
        { color: 'Green', size: 'Medium', price: 12.5, quantity: 40 },
      ]);
    });

    it('shows server 400 messages that get past the client checks', async () => {
      mockFetch({
        'POST /api/ducks': {
          status: 400,
          body: {
            statusCode: 400,
            message: ['price must be a positive number', 'quantity must be an integer number'],
            error: 'Bad Request',
          },
        },
      });
      const { user, onSaved } = renderCreate();

      await user.selectOptions(field('Color'), 'Red');
      await user.selectOptions(field('Size'), 'Large');
      await user.type(field('Price (USD)'), '20');
      await user.type(field('Quantity'), '5');
      await user.click(screen.getByRole('button', { name: 'Add Duck' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('price must be a positive number');
      expect(alert).toHaveTextContent('quantity must be an integer number');
      expect(screen.getByRole('button', { name: 'Add Duck' })).toBeEnabled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('closes on Cancel and on Esc', async () => {
      mockFetch({});
      const { user, onClose } = renderCreate();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);

      await user.click(field('Price (USD)'));
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('edit mode', () => {
    it('prefills the duck and disables color and size', () => {
      mockFetch({});
      renderEdit();

      expect(screen.getByRole('dialog', { name: 'Edit duck #4' })).toBeInTheDocument();
      expect(field('Color')).toBeDisabled();
      expect(field('Color')).toHaveValue('Black');
      expect(field('Size')).toBeDisabled();
      expect(field('Size')).toHaveValue('Medium');
      expect(field('Price (USD)')).toBeEnabled();
      expect(field('Price (USD)')).toHaveValue('15.00');
      expect(field('Quantity')).toHaveValue('950');
    });

    it('allows quantity 0', async () => {
      const fetchMock = mockFetch({
        'PATCH /api/ducks/4': {
          status: 200,
          body: { duck: { ...black4, quantity: 0 }, merged: false },
        },
      });
      const { user, onSaved } = renderEdit();

      await user.clear(field('Quantity'));
      await user.type(field('Quantity'), '0');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(requestBodies(fetchMock, 'PATCH /api/ducks/4')).toEqual([{ quantity: 0 }]);
    });

    it('rejects a negative quantity', async () => {
      const fetchMock = mockFetch({});
      const { user } = renderEdit();

      await user.clear(field('Quantity'));
      await user.type(field('Quantity'), '-1');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(field('Quantity')).toHaveAccessibleDescription('Quantity cannot be negative.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends only the price when only the price changed', async () => {
      const fetchMock = mockFetch({
        'PATCH /api/ducks/4': {
          status: 200,
          body: { duck: { ...black4, price: 16.25 }, merged: false },
        },
      });
      const { user, onSaved } = renderEdit();

      await user.clear(field('Price (USD)'));
      await user.type(field('Price (USD)'), '16.25');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(requestBodies(fetchMock, 'PATCH /api/ducks/4')).toEqual([{ price: 16.25 }]);
      expect(onSaved.mock.calls[0][1]).toEqual({ price: 16.25 });
    });

    it('sends both fields when both changed', async () => {
      const fetchMock = mockFetch({
        'PATCH /api/ducks/4': { status: 200, body: { duck: black4, merged: false } },
      });
      const { user, onSaved } = renderEdit();

      await user.clear(field('Price (USD)'));
      await user.type(field('Price (USD)'), '9.99');
      await user.clear(field('Quantity'));
      await user.type(field('Quantity'), '10');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(requestBodies(fetchMock, 'PATCH /api/ducks/4')).toEqual([
        { price: 9.99, quantity: 10 },
      ]);
    });

    it('treats a reformatted but equal price as unchanged and sends nothing', async () => {
      const fetchMock = mockFetch({});
      const { user } = renderEdit();

      await user.clear(field('Price (USD)'));
      await user.type(field('Price (USD)'), '15');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Nothing to save: price and quantity are unchanged.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('hands a 404 to onNotFound instead of showing it inline', async () => {
      mockFetch({
        'PATCH /api/ducks/4': {
          status: 404,
          body: { statusCode: 404, message: 'Duck 4 not found', error: 'Not Found' },
        },
      });
      const { user, onNotFound, onSaved } = renderEdit();

      await user.clear(field('Quantity'));
      await user.type(field('Quantity'), '1');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(onNotFound).toHaveBeenCalled());
      expect(onNotFound.mock.calls[0][0]).toMatchObject({
        status: 404,
        message: 'Duck 4 not found',
      });
      expect(onSaved).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the form open on a 409 with the message inline and the typed values intact', async () => {
      const fetchMock = mockFetch({
        'PATCH /api/ducks/4': [
          {
            status: 409,
            body: {
              statusCode: 409,
              message: 'Conflicting update, please retry',
              error: 'Conflict',
            },
          },
          { status: 200, body: { duck: { ...black4, price: 16.5, quantity: 12 }, merged: false } },
        ],
      });
      const { user, onNotFound, onSaved, onClose } = renderEdit();

      await user.clear(field('Price (USD)'));
      await user.type(field('Price (USD)'), '16.50');
      await user.clear(field('Quantity'));
      await user.type(field('Quantity'), '12');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Conflicting update, please retry',
      );
      expect(screen.getByRole('dialog', { name: 'Edit duck #4' })).toHaveAttribute('open');
      expect(field('Price (USD)')).toHaveValue('16.50');
      expect(field('Quantity')).toHaveValue('12');
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
      expect(onNotFound).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      // Resubmitting sends the same values again.
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(requestBodies(fetchMock, 'PATCH /api/ducks/4')).toEqual([
        { price: 16.5, quantity: 12 },
        { price: 16.5, quantity: 12 },
      ]);
    });
  });
});
