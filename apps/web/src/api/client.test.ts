import { vi } from 'vitest';
import { mockFetch, requestBodies } from '../test/fetch';
import { ApiError, ducksApi } from './client';

const duck = { id: 4, color: 'Black', size: 'Medium', price: 15, quantity: 950, deleted: false };

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the call to fail');
}

describe('ducksApi', () => {
  it('lists ducks', async () => {
    mockFetch({ 'GET /api/ducks': { status: 200, body: [duck] } });
    await expect(ducksApi.list()).resolves.toEqual([duck]);
  });

  it('sends JSON for create and update, and nothing for delete', async () => {
    const fetchMock = mockFetch({
      'POST /api/ducks': { status: 201, body: { duck, merged: false } },
      'PATCH /api/ducks/4': { status: 200, body: { duck, merged: false } },
      'DELETE /api/ducks/4': { status: 204 },
    });

    await ducksApi.create({ color: 'Black', size: 'Medium', price: 15, quantity: 1 });
    await ducksApi.update(4, { price: 16 });
    await expect(ducksApi.remove(4)).resolves.toBeUndefined();

    expect(requestBodies(fetchMock, 'POST /api/ducks')).toEqual([
      { color: 'Black', size: 'Medium', price: 15, quantity: 1 },
    ]);
    expect(requestBodies(fetchMock, 'PATCH /api/ducks/4')).toEqual([{ price: 16 }]);
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('parses a Nest error with a string message', async () => {
    mockFetch({
      'DELETE /api/ducks/9': {
        status: 404,
        body: { statusCode: 404, message: 'Duck 9 not found', error: 'Not Found' },
      },
    });

    const error = await caught(ducksApi.remove(9));
    expect(error.status).toBe(404);
    expect(error.messages).toEqual(['Duck 9 not found']);
    expect(error.message).toBe('Duck 9 not found');
    expect(error.error).toBe('Not Found');
    expect(error.isNotFound).toBe(true);
    expect(error.isConflict).toBe(false);
  });

  it('parses a Nest validation error with a message array', async () => {
    const messages = ['price must be a positive number', 'quantity must not be less than 1'];
    mockFetch({
      'POST /api/ducks': {
        status: 400,
        body: { statusCode: 400, message: messages, error: 'Bad Request' },
      },
    });

    const error = await caught(
      ducksApi.create({ color: 'Red', size: 'Small', price: -1, quantity: 0 }),
    );
    expect(error.status).toBe(400);
    expect(error.messages).toEqual(messages);
    expect(error.isNotFound).toBe(false);
    expect(error.isConflict).toBe(false);
  });

  it('falls back to the status when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })),
    );

    const error = await caught(ducksApi.list());
    expect(error.status).toBe(502);
    expect(error.messages).toEqual(['Request failed with status 502.']);
  });

  it('reports an unreachable server as status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const error = await caught(ducksApi.list());
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Could not reach the server/);
  });
});
