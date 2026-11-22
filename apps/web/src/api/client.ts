import type { CreateDuckInput, Duck, DuckWriteResult, UpdateDuckInput } from './types';

const BASE_URL = '/api';

/**
 * A failed API call, parsed from Nest's error shape `{ statusCode, message, error }`.
 * Nest sends `message` as a string, or as a string array for validation failures, so
 * `messages` always holds the array form. `status` is 0 when the server was unreachable.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly error: string;

  constructor(status: number, messages: string[], error: string) {
    super(messages.join(' '));
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.error = error;
  }

  /** The duck was deleted, merged away or changed by someone else since the list loaded. */
  get isStale(): boolean {
    return this.status === 404 || this.status === 409;
  }
}

interface NestErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: NestErrorBody | undefined;
  try {
    body = (await res.json()) as NestErrorBody;
  } catch {
    // Not JSON, e.g. a proxy error page. Fall back to the status line below.
  }
  const raw = body?.message;
  const messages =
    typeof raw === 'string' ? [raw] : Array.isArray(raw) && raw.length > 0 ? raw : [];
  return new ApiError(
    body?.statusCode ?? res.status,
    messages.length > 0 ? messages : [`Request failed with status ${res.status}.`],
    body?.error ?? res.statusText,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      ['Could not reach the server. Check your connection and try again.'],
      'Network Error',
    );
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const ducksApi = {
  list: () => request<Duck[]>('/ducks'),
  create: (input: CreateDuckInput) =>
    request<DuckWriteResult>('/ducks', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: UpdateDuckInput) =>
    request<DuckWriteResult>(`/ducks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: number) => request<void>(`/ducks/${id}`, { method: 'DELETE' }),
};
