import { createClient } from '@supabase/supabase-js';
import type { Environment } from '../config/env.js';

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
export const supabaseFetch: typeof fetch = (input, init) => fetch(input, {
  ...init,
  signal: init?.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000),
});

/** New client per request; never mutate shared auth state across users. */
export function createUserRepositoryClient(env: Environment, accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: authOptions,
    global: { fetch: supabaseFetch, headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/** For public auth operations only; has no elevated database permissions. */
export function createAuthClient(env: Environment) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: authOptions, global: { fetch: supabaseFetch } });
}

// Elevated clients belong only in the admin repository and operator CLI scripts.
