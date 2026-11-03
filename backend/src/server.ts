import { createApp } from './app.js';
import { readEnvironment } from './config/env.js';
import { createLogger } from './config/logger.js';

try {
  const env = readEnvironment();
  const logger = createLogger(env.LOG_LEVEL);
  const server = createApp(env).listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'LMS API listening');
  });
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  server.on('error', () => {
    logger.fatal('API could not start. Check port availability.');
    process.exitCode = 1;
  });
} catch (error) {
  // readEnvironment errors contain field names/messages only.
  console.error(error instanceof Error ? error.message : 'Unable to start API');
  process.exitCode = 1;
}
