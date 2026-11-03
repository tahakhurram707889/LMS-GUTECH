import { createClient } from '@supabase/supabase-js';
import { readEnvironment } from '../src/config/env.js';
import { createAuthClient, supabaseFetch } from '../src/repositories/supabase.js';

// Read-only operator diagnostics. Never print keys, tokens, passwords or users.
try {
  const env = readEnvironment();
  console.log('PASS: backend/.env loaded; required settings and key roles validated.');
  console.log(`Project: ${new URL(env.SUPABASE_URL).hostname}`);
  const publicClient = createAuthClient(env);
  const authHealth = await supabaseFetch(`${env.SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: env.SUPABASE_ANON_KEY },
  });
  if (!authHealth.ok) {
    console.error(`FAIL: Auth settings HTTP ${authHealth.status}. Check SUPABASE_URL and the public API key.`);
    process.exitCode = 1;
  } else {
    const settings = await authHealth.json() as { external?: { email?: boolean }; disable_signup?: boolean };
    console.log('PASS: Supabase Auth is reachable with the public API key.');
    if (settings.external?.email === false) {
      console.error('FAIL: Email/password authentication is disabled.'); process.exitCode = 1;
    }
    if (settings.disable_signup === false) {
      console.error('FAIL: Public signup is enabled; disable it for this internal LMS.'); process.exitCode = 1;
    }
    const sessionCheck = await publicClient.rpc('session_is_valid');
    // A denied anonymous call proves the protected function exists. Missing
    // functions/schema return PGRST202/42883 and must not become credential errors.
    if (sessionCheck.error && ['PGRST202', '42883'].includes(sessionCheck.error.code)) {
      console.error('FAIL: session_is_valid is missing. Apply all Supabase migrations.'); process.exitCode = 1;
    }
    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: supabaseFetch },
    });
    const authUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (authUsers.error) {
      console.error('FAIL: Server key cannot access Supabase Auth administration.'); process.exitCode = 1;
    } else console.log('PASS: server key has Auth admin access.');
    const profiles = await admin.from('profiles').select('id', { head: true, count: 'exact' }).eq('role', 'admin').eq('is_active', true);
    if (profiles.error) {
      console.error('FAIL: profiles schema is unavailable. Apply migrations and check server permissions.'); process.exitCode = 1;
    } else if (!profiles.count) {
      console.error('FAIL: No active LMS administrator profile. Run npm run bootstrap:admin -w backend.'); process.exitCode = 1;
    } else console.log('PASS: at least one active LMS administrator profile exists.');
  }
} catch (error) {
  const message = error instanceof Error && error.message.startsWith('Invalid environment configuration')
    ? error.message : 'Cannot complete checks. Check backend environment settings, DNS/network access and Supabase availability.';
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}
