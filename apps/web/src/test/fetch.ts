import { vi } from 'vitest';

export interface Reply {
  status: number;
  body?: unknown;
}

type Route = Reply | Reply[] | (() => Reply | Promise<Reply>);

/**
 * Stubs global fetch with routes keyed by "METHOD /path", e.g. "PATCH /api/ducks/4".
 * An array replies in order and repeats its last entry; a function can hold a reply back
 * to test pending states. Unknown routes fail the test loudly.
 */
export function mockFetch(routes: Record<string, Route>) {
  const counts = new Map<string, number>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);

    let reply: Reply;
    if (typeof route === 'function') {
      reply = await route();
    } else if (Array.isArray(route)) {
      const n = counts.get(key) ?? 0;
      counts.set(key, n + 1);
      reply = route[Math.min(n, route.length - 1)];
    } else {
      reply = route;
    }

    const hasBody = reply.body !== undefined && reply.status !== 204;
    return new Response(hasBody ? JSON.stringify(reply.body) : null, {
      status: reply.status,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Parsed JSON bodies of every call to one route, in order. */
export function requestBodies(fetchMock: ReturnType<typeof mockFetch>, key: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key)
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined));
}

/** Count of calls to one route. */
export function callCount(fetchMock: ReturnType<typeof mockFetch>, key: string): number {
  return requestBodies(fetchMock, key).length;
}

/** A promise you resolve by hand, for holding a reply back. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
