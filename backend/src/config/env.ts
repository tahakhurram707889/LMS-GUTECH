import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';

// Find this package rather than using the shell's working directory. This also
// works for operator scripts compiled under .scripts-build/src/config.
export function backendEnvironmentFile() {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(directory, 'package.json'))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Cannot locate the backend package configuration');
    directory = parent;
  }
  return join(directory, '.env');
}
config({ path: process.env.DOTENV_CONFIG_PATH ?? backendEnvironmentFile() });

const secret = z.string().trim().min(20).refine((value) => !value.startsWith('replace-'), {
  message: 'Replace the template value with the key from your Supabase project',
});
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().url().transform((value) => new URL(value).origin),
  SUPABASE_URL: z.string().trim().url(),
  SUPABASE_ANON_KEY: secret,
  SUPABASE_SERVICE_ROLE_KEY: secret,
  PASSWORD_RESET_REDIRECT: z.string().trim().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  COOKIE_SAME_SITE: z.enum(['strict','lax','none']).optional(),
});

export type Environment = z.infer<typeof schema>;

export function readEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Print field names and validation messages only, never input values or secrets.
    const messages = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${messages.join('\n')}`);
  }
  const env = result.data;
  if (env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_publishable_')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY requires a server secret/service-role key, not a publishable key');
  }
  if (env.SUPABASE_ANON_KEY.startsWith('sb_secret_')) {
    throw new Error('SUPABASE_ANON_KEY requires a publishable/anon key, not a server secret');
  }
  for (const [field, expected] of [['SUPABASE_ANON_KEY', 'anon'], ['SUPABASE_SERVICE_ROLE_KEY', 'service_role']] as const) {
    const key = env[field];
    if (key.split('.').length !== 3) continue;
    let claims: { role?: string; ref?: string };
    try { claims = z.object({ role: z.string().optional(), ref: z.string().optional() }).parse(JSON.parse(Buffer.from(key.split('.')[1]!, 'base64url').toString('utf8'))); }
    catch { throw new Error(`${field} is not a valid Supabase key format`); }
    if (claims.role && claims.role !== expected) throw new Error(`${field} has the wrong Supabase role`);
    const host = new URL(env.SUPABASE_URL).hostname;
    if (host.endsWith('.supabase.co') && claims.ref && claims.ref !== host.split('.')[0]) {
      throw new Error(`${field} belongs to a different Supabase project than SUPABASE_URL`);
    }
  }
  if (env.COOKIE_SAME_SITE === 'none' && env.NODE_ENV !== 'production') {
    throw new Error('COOKIE_SAME_SITE=none requires production HTTPS and secure cookies');
  }
  if (new URL(env.PASSWORD_RESET_REDIRECT).origin !== env.CLIENT_ORIGIN) {
    throw new Error('PASSWORD_RESET_REDIRECT must use CLIENT_ORIGIN');
  }
  if (env.NODE_ENV === 'production' && !env.CLIENT_ORIGIN.startsWith('https://')) {
    throw new Error('Production CLIENT_ORIGIN must use HTTPS');
  }
  return env;
}
