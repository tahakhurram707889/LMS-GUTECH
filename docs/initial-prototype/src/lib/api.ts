const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
let accessToken: string | undefined;
export function setAccessToken(token?: string) { accessToken = token; }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () => fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers } });
  let response = await send();
  if(response.status===401&&accessToken&&path!=='/auth/refresh'){
    const refreshed=await fetch(`${API_URL}/auth/refresh`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include'});
    if(refreshed.ok){const data=await refreshed.json();setAccessToken(data.data.accessToken);response=await send();}
    else setAccessToken(undefined);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? 'Something went wrong');
  return body.data as T;
}
