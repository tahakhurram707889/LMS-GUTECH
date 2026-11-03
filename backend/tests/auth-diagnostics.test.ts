import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { authenticationError, profileDatabaseError } from '../src/utils/auth-errors.js';
import { AuthRepository } from '../src/repositories/auth.repository.js';
import { LoginRepository } from '../src/repositories/login.repository.js';
import { AuthService } from '../src/services/auth.service.js';
import { createAuthClient, createUserRepositoryClient } from '../src/repositories/supabase.js';
import { backendEnvironmentFile, readEnvironment, type Environment } from '../src/config/env.js';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/utils/api-error.js';
import request from 'supertest';
import { createApp } from '../src/app.js';

vi.mock('../src/repositories/supabase.js', () => ({
  createAuthClient: vi.fn(), createUserRepositoryClient: vi.fn(),
}));
const env: Environment = {
  NODE_ENV: 'test', PORT: 4000, CLIENT_ORIGIN: 'http://localhost:5173',
  SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: 'test-anon-value-not-a-real-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-value-not-a-real-key',
  PASSWORD_RESET_REDIRECT: 'http://localhost:5173/reset-password', LOG_LEVEL: 'silent',
};
const session = { access_token: 'new-session-token', user: { id: 'user-id' } } as Session;
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.spyOn(LoginRepository.prototype,'resolve').mockResolvedValue({id:'user-id',email:'user@example.test'}); });

describe('Authentication failure classification', () => {
  it('locates backend configuration independently of the shell working directory', () => {
    expect(backendEnvironmentFile()).toBe(fileURLToPath(new URL('../.env', import.meta.url)));
  });
  it('keeps invalid credentials generic', () => {
    expect(authenticationError({ status: 400, code: 'invalid_credentials' }))
      .toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' });
  });
  it('reports network failures as service unavailability, not a bad password', async () => {
    vi.mocked(createAuthClient).mockReturnValue({ auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: { name: 'AuthRetryableFetchError', status: 0 } }),
    } } as unknown as ReturnType<typeof createAuthClient>);
    await expect(new AuthRepository(env).login('user@example.test', 'correct-password'))
      .rejects.toMatchObject({ status: 503, code: 'AUTH_UNAVAILABLE' });
  });
  it('reports thrown connection errors without exposing provider internals', async () => {
    vi.mocked(createAuthClient).mockReturnValue({ auth: {
      signInWithPassword: vi.fn().mockRejectedValue(new TypeError('fetch failed with sensitive internal details')),
    } } as unknown as ReturnType<typeof createAuthClient>);
    await expect(new AuthRepository(env).login('user@example.test', 'correct-password'))
      .rejects.toMatchObject({ status: 503, code: 'AUTH_UNAVAILABLE' });
  });
  it('identifies server API key failures and provider throttling', () => {
    expect(authenticationError({ status: 401, message: 'Invalid API key' })).toMatchObject({ status: 503, code: 'AUTH_CONFIGURATION_ERROR' });
    expect(authenticationError({ status: 429 })).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
  });
  it.each(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])('identifies missing schema/function %s', (code) => {
    try { profileDatabaseError({ code }); throw new Error('Expected an error'); }
    catch (error) { expect(error).toMatchObject({ status: 503, code: 'LMS_SETUP_REQUIRED' }); }
  });
  it('does not expose missing profiles as a setup diagnostic', () => {
    expect(() => profileDatabaseError({ code: 'PGRST116' })).not.toThrow();
  });
  it('preserves a setup failure after successful authentication and revokes only the new session', async () => {
    vi.spyOn(AuthRepository.prototype, 'login').mockResolvedValue(session);
    vi.spyOn(AuthRepository.prototype, 'profile').mockRejectedValue(new ApiError(503, 'LMS_SETUP_REQUIRED', 'Apply migrations'));
    const logout = vi.spyOn(AuthRepository.prototype, 'logout').mockResolvedValue();
    await expect(new AuthService(env).login('user@example.test', 'correct-password'))
      .rejects.toMatchObject({ status: 503, code: 'LMS_SETUP_REQUIRED' });
    expect(logout).toHaveBeenCalledWith(session.access_token, 'local');
    const response = await request(createApp(env)).post('/api/auth/login')
      .send({ username: 'user.name', password: 'correct-password' });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('LMS_SETUP_REQUIRED');
  });
  it('keeps inactive or unprovisioned accounts behind a generic credential error', async () => {
    vi.spyOn(AuthRepository.prototype, 'login').mockResolvedValue(session);
    vi.spyOn(AuthRepository.prototype, 'profile').mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Account access is unavailable'));
    vi.spyOn(AuthRepository.prototype, 'logout').mockResolvedValue();
    await expect(new AuthService(env).login('user@example.test', 'correct-password'))
      .rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
  });
  it('distinguishes a missing session RPC from an expired user session', async () => {
    vi.mocked(createAuthClient).mockReturnValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null }) } } as unknown as ReturnType<typeof createAuthClient>);
    vi.mocked(createUserRepositoryClient).mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202' } }) } as unknown as ReturnType<typeof createUserRepositoryClient>);
    await expect(new AuthRepository(env).identity('token')).rejects.toMatchObject({ status: 503, code: 'LMS_SETUP_REQUIRED' });
  });
  it('rejects a publishable key in the server-only setting without echoing it', () => {
    const values = { ...env, PORT: String(env.PORT), SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_example_value_not_a_secret' };
    expect(() => readEnvironment(values)).toThrow('requires a server secret/service-role key');
  });
  it('rejects JWT keys for a different project', () => {
    const token = `header.${Buffer.from(JSON.stringify({ role: 'anon', ref: 'different-project' })).toString('base64url')}.signature`;
    expect(() => readEnvironment({ ...env, PORT: String(env.PORT), SUPABASE_URL: 'https://target-project.supabase.co', SUPABASE_ANON_KEY: token }))
      .toThrow('belongs to a different Supabase project');
  });
});
