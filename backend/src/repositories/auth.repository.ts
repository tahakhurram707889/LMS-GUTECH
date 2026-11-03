import type { Environment } from '../config/env.js';
import { createAuthClient, createUserRepositoryClient } from './supabase.js';
import { ApiError } from '../utils/api-error.js';
import { authenticationError, profileDatabaseError } from '../utils/auth-errors.js';

export class AuthRepository {
  constructor(private env: Environment) {}
  async login(email: string, password: string) {
    try {
      const { data, error } = await createAuthClient(this.env).auth.signInWithPassword({ email, password });
      if (error) throw authenticationError(error);
      if (!data.session) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'The authentication service did not return a session. Please try again.');
      return data.session;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw authenticationError(error);
    }
  }
  async refresh(refreshToken: string) {
    const { data, error } = await createAuthClient(this.env).auth.refreshSession({ refresh_token: refreshToken });
    if (error) throw authenticationError(error, 'session');
    if (!data.session) throw new ApiError(401, 'UNAUTHORIZED', 'Your session has expired');
    return data.session;
  }
  async identity(token: string) {
    const { data, error } = await createAuthClient(this.env).auth.getUser(token);
    if (error) throw authenticationError(error, 'session');
    if (!data.user) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in');
    const session = await createUserRepositoryClient(this.env, token).rpc('session_is_valid');
    profileDatabaseError(session.error);
    if (session.data !== true) throw new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
    return data.user;
  }
  async profile(token: string, id: string) {
    const { data, error } = await createUserRepositoryClient(this.env, token).from('profiles').select('*').eq('id', id).single();
    profileDatabaseError(error);
    if (!data?.is_active) throw new ApiError(401, 'UNAUTHORIZED', 'Account access is unavailable');
    return data;
  }
  async forgot(email: string) {
    await createAuthClient(this.env).auth.resetPasswordForEmail(email, { redirectTo: this.env.PASSWORD_RESET_REDIRECT });
  }
  async recover(tokenHash: string) {
    const { data, error } = await createAuthClient(this.env).auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error || !data.session) throw new ApiError(401, 'EXPIRED_LINK', 'This reset link is invalid or expired. Request a new link.');
    return data.session;
  }
  async updatePassword(token: string, password: string) {
    await this.authRequest('/user', 'PUT', token, { password });
  }
  async logout(token: string, scope: 'global' | 'others' | 'local' = 'global') {
    await this.authRequest(`/logout?scope=${scope}`, 'POST', token);
  }
  private async authRequest(path: string, method: string, token: string, body?: unknown) {
    const response = await fetch(`${this.env.SUPABASE_URL}/auth/v1${path}`, {
      signal: AbortSignal.timeout(10_000),
      method, headers: { apikey: this.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new ApiError(400, 'AUTH_ERROR', 'Account operation failed. Please sign in and try again.');
  }
}
