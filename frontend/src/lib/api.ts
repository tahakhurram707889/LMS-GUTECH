const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
let accessToken: string | undefined;
const SESSION_HINT_KEY = 'gutech.session-present';
function setSessionHint(present: boolean) {
  try {
    if (present) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Storage can be disabled by browser policy. In that case bootstrap probes
    // the server so a valid HttpOnly refresh cookie can still restore a session.
  }
}
function hasSessionHint() {
  try { return localStorage.getItem(SESSION_HINT_KEY) === '1'; }
  catch { return true; }
}
export function setAccessToken(token?: string) {
  accessToken = token;
  setSessionHint(Boolean(token));
  window.dispatchEvent(new Event('sessiontoken'));
}
export function getAccessToken() { return accessToken; }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export type Page<T> = { data: T[]; meta: { page: number; pageSize: number; total: number; nextCursor?: string }; summary?: { obtained: number; maximum: number; percentage: number } };
let refreshing: Promise<{ accessToken: string; profile: unknown }> | undefined;
export function refreshSession(): Promise<{ accessToken: string; profile: unknown } | undefined> {
  // The refresh credential is HttpOnly and intentionally unavailable to JS.
  // A non-secret hint avoids sending an expected 401 for a signed-out visitor.
  if (!hasSessionHint()) return Promise.resolve(undefined);
  if (!refreshing) refreshing = request<{ accessToken: string; profile: unknown }>('/auth/refresh', { method: 'POST', body: '{}' }, false)
    .then((result) => { setAccessToken(result.data.accessToken); return result.data; })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        setAccessToken();
        window.dispatchEvent(new Event('sessionexpired'));
      }
      throw error;
    })
    .finally(() => { refreshing = undefined; });
  return refreshing;
}
async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<{ data: T } & Record<string, unknown>> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response:Response;
  try { response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers }); }
  catch (error) {
    if(error instanceof DOMException&&error.name==='AbortError')throw error;
    throw new ApiError(0,'NETWORK_ERROR','Unable to connect to the workspace server. Please try again.');
  }
  if (response.status === 401 && accessToken && retry && !path.startsWith('/auth/')) {
    try { await refreshSession(); } catch { throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in again'); }
    return request<T>(path, init, false);
  }
  if (response.status === 204) return { data: undefined as T };
  const body = await response.json().catch(() => { throw new ApiError(response.status, 'INVALID_RESPONSE', 'The server returned an invalid response'); });
  if (!response.ok) throw new ApiError(response.status, body.error?.code ?? 'ERROR', body.error?.message ?? 'Something went wrong');
  return body;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> { return (await request<T>(path, init)).data; }
export async function apiPage<T>(path: string, signal?: AbortSignal): Promise<Page<T>> { return await request<T[]>(path, { signal }) as Page<T>; }
export function mutate<T = unknown>(path: string, data: unknown = {}, method = 'POST') { return api<T>(path, { method, body: JSON.stringify(data) }); }
export async function downloadCsv(path: string) {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!response.ok) throw new Error('Export failed. Please sign in and retry.');
  const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = 'gradebook.csv'; link.click(); URL.revokeObjectURL(url);
}
