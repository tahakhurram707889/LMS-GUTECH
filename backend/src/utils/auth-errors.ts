import { ApiError } from './api-error.js';

/** Classify infrastructure failures without exposing provider responses or keys. */
export function authenticationError(error: unknown, operation: 'login' | 'session' = 'login') {
  const failure = error as { code?: string; status?: number; name?: string; message?: string } | null;
  if (!failure || failure.status === 0 || failure.status === undefined || (failure.status ?? 0) >= 500 || failure.name === 'AuthRetryableFetchError') {
    return new ApiError(503, 'AUTH_UNAVAILABLE', 'Cannot connect to the authentication service. Check the server connection and try again.');
  }
  if (failure.status === 429) return new ApiError(429, 'RATE_LIMITED', 'Too many sign-in requests. Please try again later.');
  if (failure.code === 'email_provider_disabled' || failure.code === 'signup_disabled') {
    return new ApiError(503, 'AUTH_CONFIGURATION_ERROR', 'Email/password authentication is not configured for this workspace. Contact your administrator.');
  }
  if (failure.code === 'invalid_api_key' || /invalid api key/i.test(failure.message ?? '')) {
    return new ApiError(503, 'AUTH_CONFIGURATION_ERROR', 'The server authentication key is invalid. Contact your administrator.');
  }
  return operation === 'login'
    ? new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password')
    : new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
}

export function profileDatabaseError(error: { code?: string } | null) {
  if (!error || error.code === 'PGRST116') return;
  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(error.code ?? '')) {
    throw new ApiError(503, 'LMS_SETUP_REQUIRED', 'The LMS database is not ready. Ask your administrator to apply the Supabase migrations.');
  }
  if (error.code === '42501') {
    throw new ApiError(503, 'LMS_CONFIGURATION_ERROR', 'LMS database permissions are not configured correctly. Contact your administrator.');
  }
  throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Cannot load your LMS account right now. Check the database connection and try again.');
}
