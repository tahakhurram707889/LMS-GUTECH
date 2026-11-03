import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/health.controller.js';
import type { Environment } from '../config/env.js';

export function apiRouter(env: Environment) {
  const router = Router();
  router.get('/health', getHealth);
  router.get('/health/ready', getReadiness(env));
  return router;
}
