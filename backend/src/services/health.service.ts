import { createClient } from '@supabase/supabase-js';
import type { Environment } from '../config/env.js';
import { supabaseFetch } from '../repositories/supabase.js';

/** Process liveness only. */
export function healthStatus() {
  return { status: 'ok' as const, service: 'gutech-lms-api' };
}

/** Read-only check of the schema required to resolve usernames and load profiles. */
export async function databaseReadiness(env: Environment) {
  const project = new URL(env.SUPABASE_URL).hostname;
  try {
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: supabaseFetch },
    });
    const checks = await Promise.all([
      client.from('profiles').select('id,email,username,role,is_active,must_change_password,full_name').limit(0),
      client.rpc('session_is_valid'),
    ]);
  const missing: string[] = [];
  const profileError = checks[0].error;
  if (profileError) {
    if (['42703', 'PGRST204'].includes(profileError.code ?? '')) missing.push('public.profiles.username (migration 0014_usernames_dashboards.sql)');
    else if (['42P01', 'PGRST205'].includes(profileError.code ?? '')) missing.push('public.profiles (migration 0001_core.sql)');
    else if (profileError.code === '42501') missing.push('service role SELECT permission on public.profiles');
    else return { status: 'unavailable' as const, project, diagnosis: 'Database probe failed; check project URL, server key, network access, and Supabase availability.' };
  }
  const sessionError = checks[1].error;
  if (sessionError && ['PGRST202', '42883', 'PGRST203'].includes(sessionError.code ?? '')) {
    missing.push('public.session_is_valid() (migration 0012_session_validation.sql)');
  } else if (sessionError && sessionError.code === '42501') {
    // Anonymous/role-less execution may be denied by design; existence is proven unless PostgREST says otherwise.
  } else if (sessionError) {
    return { status: 'unavailable' as const, project, diagnosis: 'Database probe failed; check project URL, server key, network access, and Supabase availability.' };
  }
  if (missing.length) return { status: 'not_ready' as const, project, missing, action: 'Apply the listed migrations to this Supabase project, then restart or recheck the backend.' };
  return { status: 'ready' as const, project };
  } catch {
    return { status: 'unavailable' as const, project, diagnosis: 'Database probe failed; check project URL, server key, network access, and Supabase availability.' };
  }
}
