import type { Request, Response } from 'express';
import type { Environment } from '../config/env.js';
import { AuthService } from '../services/auth.service.js';
import { toCamelCase } from '../repositories/mapper.js';
import { ApiError } from '../utils/api-error.js';
export function authController(env: Environment) {
  const service = new AuthService(env);
  const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: env.COOKIE_SAME_SITE??'strict' as const, path: '/api', maxAge: 30 * 24 * 60 * 60 * 1000 };
  const clearRefreshCookie = (res: Response) => res.clearCookie('refreshToken', { ...cookieOptions, maxAge: undefined });
  const reply = (res: Response, result: Awaited<ReturnType<AuthService['login']>>) => {
    res.cookie('refreshToken', result.session.refresh_token, cookieOptions);
    res.set('Cache-Control', 'no-store');
    res.json({ data: { accessToken: result.session.access_token, profile: toCamelCase(result.profile) } });
  };
  return {
    login: async (req: Request, res: Response) => reply(res, await service.login(req.body.username, req.body.password)),
    refresh: async (req: Request, res: Response) => {
      if (!req.cookies.refreshToken) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in');
      try {
        reply(res, await service.refresh(req.cookies.refreshToken));
      } catch (error) {
        // A rotated, expired, or revoked credential must not be retried forever.
        if (error instanceof ApiError && error.status === 401) clearRefreshCookie(res);
        throw error;
      }
    },
    forgot: async (req: Request, res: Response) => { await service.forgot(req.body.email); res.json({ data: { message: 'If this account exists, a reset link has been sent.' } }); },
    change: async (req: Request, res: Response) => {
      await service.change(req.accessToken!, req.user!.id, req.body.currentPassword, req.body.newPassword);
      clearRefreshCookie(res); res.json({ data: { message: 'Password changed. Please sign in again.' } });
    },
    reset: async (req: Request, res: Response) => { await service.reset(req.body.tokenHash, req.body.newPassword); res.json({ data: { message: 'Password reset. Please sign in.' } }); },
    logout: async (req: Request, res: Response) => { await service.logout(req.accessToken!); clearRefreshCookie(res); res.status(204).end(); },
  };
}
