import type { RequestHandler } from 'express';
import { databaseReadiness, healthStatus } from '../services/health.service.js';
import type { Environment } from '../config/env.js';

export const getHealth: RequestHandler = (_req, res) => {
  res.json({ data: healthStatus() });
};

export const getReadiness = (env: Environment): RequestHandler => async (_req, res) => {
  const readiness = await databaseReadiness(env);
  res.status(readiness.status === 'ready' ? 200 : 503).json({ data: readiness });
};
