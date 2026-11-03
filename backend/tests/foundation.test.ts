import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { readEnvironment, type Environment } from '../src/config/env.js';
import { paginationRange } from '../src/schemas/pagination.js';
import { toCamelCase } from '../src/repositories/mapper.js';
import { validateBody } from '../src/middleware/validate.js';
import { errorHandler } from '../src/middleware/error-handler.js';

const env: Environment = {
  NODE_ENV: 'test', PORT: 4000, CLIENT_ORIGIN: 'http://localhost:5173',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'test-anon-value-not-a-real-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-value-not-a-real-key',
  PASSWORD_RESET_REDIRECT: 'http://localhost:5173/reset-password', LOG_LEVEL: 'silent',
};

describe('HTTP foundation', () => {
  it('GET /api/health returns liveness without claiming database readiness', async () => {
    const response = await request(createApp(env)).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok', service: 'gutech-lms-api' } });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('rejects an untrusted browser origin', async () => {
    const response = await request(createApp(env)).get('/api/health').set('Origin', 'https://untrusted.test');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
  it('allows the configured origin and credentials', async () => {
    const response = await request(createApp(env)).get('/api/health').set('Origin', env.CLIENT_ORIGIN);
    expect(response.headers['access-control-allow-origin']).toBe(env.CLIENT_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
  it('has no public signup endpoint', async () => {
    expect((await request(createApp(env)).post('/api/auth/signup')).status).toBe(404);
  });
  it('rejects malformed JSON without reflecting it', async () => {
    const response = await request(createApp(env)).post('/api/missing')
      .set('Content-Type', 'application/json').send('{"password":"private",');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(response.body)).not.toContain('private');
  });
  it('rejects bodies larger than 1 MB', async () => {
    const response = await request(createApp(env)).post('/api/missing').send({ value: 'a'.repeat(1_100_000) });
    expect(response.status).toBe(413);
  });
  it('blocks cookie-authenticated writes without a trusted origin', async () => {
    const response = await request(createApp(env)).post('/api/missing').set('Cookie', 'refreshToken=test');
    expect(response.status).toBe(403);
  });
});

describe('validation and repository boundaries', () => {
  it('bounds pagination and calculates inclusive ranges', () => {
    expect(paginationRange({ page: '2', pageSize: '20' })).toEqual({ page: 2, pageSize: 20, from: 20, to: 39 });
    expect(() => paginationRange({ pageSize: 101 })).toThrow();
    expect(() => paginationRange({ page: -1 })).toThrow();
  });
  it('maps nested database fields in one place', () => {
    expect(toCamelCase({ full_name: 'Noor', courses: [{ created_at: '2026' }] }))
      .toEqual({ fullName: 'Noor', courses: [{ createdAt: '2026' }] });
  });
  it('rejects missing configuration without printing credential values', () => {
    expect(() => readEnvironment({ SUPABASE_ANON_KEY: 'sensitive' })).toThrow('Invalid environment');
    try { readEnvironment({ SUPABASE_ANON_KEY: 'sensitive' }); }
    catch (error) { expect(String(error)).not.toContain('sensitive'); }
  });
  it('rejects request bodies with unknown privilege fields', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validateBody(z.object({ fullName: z.string().min(1) }).strict()),
      (_req, res) => { res.json({ data: 'ok' }); });
    app.use(errorHandler);
    const response = await request(app).post('/test').send({ fullName: 'Noor', role: 'admin' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect((await request(app).post('/test').send({ fullName: 'Noor' })).status).toBe(200);
  });
});
