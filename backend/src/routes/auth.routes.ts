import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Environment } from '../config/env.js';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, forgotSchema, changeSchema, resetSchema } from '../schemas/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { lmsController } from '../controllers/lms.controller.js';
const limited = { error: { code: 'RATE_LIMITED', message: 'Please try again later', details: [] } };
export function authRouter(env: Environment) {
  const router = Router(); const controller = authController(env);
  const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 5, keyGenerator: (req) => `${req.ip}:${req.body.username}`, message: limited });
  const loginIpLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, message: limited });
  const forgotLimit = rateLimit({ windowMs: 60 * 60_000, limit: 3, keyGenerator: (req) => req.body.email as string, message: limited });
  router.post('/login', loginIpLimit, validateBody(loginSchema), loginLimit, asyncHandler(controller.login));
  router.post('/refresh', validateBody(loginSchema.pick({}).strict()), asyncHandler(controller.refresh));
  router.post('/forgot-password', validateBody(forgotSchema), forgotLimit, asyncHandler(controller.forgot));
  router.post('/reset-password', validateBody(resetSchema), asyncHandler(controller.reset));
  router.post('/change-password', requireAuth(env), validateBody(changeSchema), asyncHandler(controller.change));
  router.post('/logout', (_req,res,next)=>{
    // Clear the browser cookie even when its access token is expired/revoked.
    res.clearCookie('refreshToken',{httpOnly:true,secure:env.NODE_ENV==='production',sameSite:env.COOKIE_SAME_SITE??'strict',path:'/api'});next();
  }, requireAuth(env), asyncHandler(controller.logout));
  router.get('/me', requireAuth(env), asyncHandler(lmsController(env,'profile.get')));
  return router;
}
