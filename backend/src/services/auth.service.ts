import type { Environment } from '../config/env.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import { ApiError } from '../utils/api-error.js';
import { LoginRepository } from '../repositories/login.repository.js';
export class AuthService {
  private repository: AuthRepository;
  constructor(private env: Environment) { this.repository = new AuthRepository(env); }
  async login(username: string, password: string) {
    // Apply a floor to both successful and failed attempts; errors remain generic.
    const minimum = new Promise((resolve) => setTimeout(resolve, 500));
    try { return await this.loginByUsername(username, password); }
    finally { await minimum; }
  }
  private async loginByUsername(username: string, password: string) {
    const account = await new LoginRepository(this.env).resolve(username);
    if (!account) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    const session = await this.repository.login(account.email, password);
    try {
      const profile = await this.repository.profile(session.access_token, session.user.id);
      if (profile.id !== account.id) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
      return { session, profile };
    } catch (error) {
      await this.repository.logout(session.access_token, 'local').catch(() => {});
      if (error instanceof ApiError && error.status >= 500) throw error;
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }
  }
  async refresh(token: string) {
    const session = await this.repository.refresh(token);
    try {
      const profile = await this.repository.profile(session.access_token, session.user.id);
      return { session, profile };
    } catch (error) {
      // Refresh rotates the token. If the account is no longer usable, revoke
      // the new session rather than leaving an unreachable live credential.
      await this.repository.logout(session.access_token, 'local').catch(() => {});
      throw error;
    }
  }
  async forgot(email: string) {
    // Same response and minimum duration for known and unknown accounts.
    await Promise.all([this.repository.forgot(email).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 500))]);
  }
  async change(token: string, id: string, currentPassword: string, newPassword: string) {
    const profile = await this.repository.profile(token, id);
    if (currentPassword === newPassword) throw new ApiError(422, 'VALIDATION_ERROR', 'Choose a different new password');
    const fresh = await this.repository.login(profile.email, currentPassword);
    await this.repository.updatePassword(fresh.access_token, newPassword);
    await this.repository.logout(fresh.access_token);
  }
  async reset(tokenHash: string, newPassword: string) {
    const session = await this.repository.recover(tokenHash);
    await this.repository.updatePassword(session.access_token, newPassword);
    await this.repository.logout(session.access_token);
  }
  logout(token: string) { return this.repository.logout(token); }
}
