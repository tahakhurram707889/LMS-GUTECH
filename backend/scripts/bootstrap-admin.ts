import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { readEnvironment } from '../src/config/env.js';
import { AdminRepository } from '../src/repositories/admin.repository.js';
import { AuthService } from '../src/services/auth.service.js';
import { password, email, username } from '../src/schemas/auth.js';
import { supabaseFetch } from '../src/repositories/supabase.js';

// Operator-only bootstrap. It never changes an existing administrator's password.
const env = readEnvironment();
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: supabaseFetch },
});
const existing = await client.from('profiles').select('id,email,username').eq('role', 'admin').limit(1);
if (existing.error) {
  console.error('Cannot read the LMS schema. Check the project connection/server key and apply the migrations first.');
  process.exitCode = 1;
} else if (existing.data?.length) {
  console.log(`An administrator already exists: ${existing.data[0]!.username}`);
  console.log('Use that account and its LMS password, or use Forgot password. No accounts were changed.');
} else {
  let adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (!adminEmail && stdin.isTTY) {
    const terminal = createInterface({ input: stdin, output: stdout });
    try { adminEmail = await terminal.question('Email for your first LMS administrator: '); }
    finally { terminal.close(); }
  }
  const input = z.object({
    email,
    username,
    fullName: z.string().trim().min(1).max(120),
    tempPassword: password,
  }).safeParse({
    email: adminEmail,
    username: process.env.BOOTSTRAP_ADMIN_USERNAME,
    fullName: process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator',
    tempPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || `Lms9!${randomBytes(18).toString('base64url')}`,
  });
  if (!input.success) {
    console.error('Set BOOTSTRAP_ADMIN_USERNAME (3-64 letters/numbers/dots/underscores/hyphens) and a valid BOOTSTRAP_ADMIN_EMAIL locally. A configured password must have 10+ characters with a letter and number.');
    process.exitCode = 1;
  } else {
    let createdId: string | undefined;
    let verified = false;
    try {
      const profile = await new AdminRepository(env).createUser({ ...input.data, role: 'admin' });
      createdId = profile.id;
      const auth = new AuthService(env);
      const result = await auth.login(input.data.username, input.data.tempPassword);
      verified = true;
      await auth.logout(result.session.access_token).catch(() => {});
      console.log('Administrator created and login verified.');
      // Print only the identifier; never print passwords or tokens.
      console.log(`LMS username: ${input.data.username}`);
      if (!process.env.BOOTSTRAP_ADMIN_PASSWORD) {
        await auth.forgot(input.data.email);
        console.log('A password reset email was requested. Complete recovery to set your LMS password. Verify SMTP delivery if it does not arrive.');
      } else console.log('Use the temporary password you supplied locally; it is never printed.');
      console.log('Sign in at http://localhost:5173 and change this password when prompted.');
    } catch {
      if (createdId && !verified) {
        const rollback = await client.auth.admin.deleteUser(createdId);
        if (rollback.error) console.error('The newly created account could not be rolled back. Use Forgot password after correcting the connection/schema.');
      }
      console.error('Account setup or login verification failed. Check connectivity, the server key, and the applied migrations. No existing account was modified.');
      process.exitCode = 1;
    }
  }
}
