import type { RequestHandler } from 'express';
import type { Environment } from '../config/env.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import { createUserRepositoryClient } from '../repositories/supabase.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/api-error.js';

export function requireAuth(env: Environment): RequestHandler {
  const repository = new AuthRepository(env);
  return asyncHandler(async (req, _res, next) => {
    const token = req.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in');
    const identity = await repository.identity(token);
    const profile = await repository.profile(token, identity.id);
    req.user = { id: identity.id, role: profile.role, mustChangePassword: profile.must_change_password };
    req.accessToken = token;
    req.db = createUserRepositoryClient(env, token);
    next();
  });
}
export const requirePasswordChanged: RequestHandler = (req, _res, next) => {
  if (req.user?.mustChangePassword) return next(new ApiError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your temporary password to continue'));
  next();
};
export function requireRole(...roles: ('admin' | 'teacher' | 'student')[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action'));
    next();
  };
}
