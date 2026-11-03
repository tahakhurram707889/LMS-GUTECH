import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import type { Environment } from './config/env.js';
import { createLogger } from './config/logger.js';
import { ApiError } from './utils/api-error.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';
import { authRouter } from './routes/auth.routes.js';
import { lmsRouter } from './routes/lms.routes.js';

export function createApp(env: Environment) {
  const app = express();
  app.disable('x-powered-by');
  // Trust no proxy by default. Configure known proxy subnets explicitly at deployment.
  app.set('trust proxy', false);
  app.use(pinoHttp({
    logger: createLogger(env.LOG_LEVEL),
    genReqId: () => randomUUID(),
    serializers: {
      req: (req: { id: string; method: string }) => ({ id: req.id, method: req.method }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  }));
  app.use(helmet());
  app.use(cookieParser());
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || origin === env.CLIENT_ORIGIN) callback(null, true);
      else callback(new ApiError(403, 'FORBIDDEN', 'This origin is not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  // Enforce Origin on cookie-authenticated writes too. CORS is not authentication.
  app.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.cookies?.refreshToken &&
      req.get('origin') !== env.CLIENT_ORIGIN) {
      next(new ApiError(403, 'FORBIDDEN', 'A trusted origin is required'));
      return;
    }
    next();
  });
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests', details: [] } },
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter(env));
  app.use('/api/auth', authRouter(env), notFound);
  app.use('/api', lmsRouter(env));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
