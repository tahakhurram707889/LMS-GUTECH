import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/** All future mutation routes must use a strict body schema before controllers. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}
