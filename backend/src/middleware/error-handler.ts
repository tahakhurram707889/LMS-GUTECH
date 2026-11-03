import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/api-error.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'The requested endpoint does not exist'));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check your input',
        details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      },
    });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }
  const parserError = error as { type?: string };
  if ((error as {code?:string})?.code === 'LIMIT_FILE_SIZE') {
    res.status(422).json({error:{code:'FILE_TOO_LARGE',message:'Maximum upload size is 25 MB (10 MB for complaints)',details:[]}});
    return;
  }
  if ((error as {code?:string})?.code?.startsWith('LIMIT_')) {
    res.status(422).json({error:{code:'INVALID_UPLOAD',message:'Upload one file with valid form fields',details:[]}});
    return;
  }
  if (parserError?.type === 'entity.parse.failed' || parserError?.type === 'entity.too.large') {
    const tooLarge = parserError.type === 'entity.too.large';
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
        message: tooLarge ? 'JSON body exceeds the 1 MB limit' : 'Malformed JSON body',
        details: [],
      },
    });
    return;
  }
  // Do not serialize the thrown object: provider errors may contain sensitive data.
  req.log.error({ requestId: req.id }, 'Unhandled request error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: [] },
  });
};
