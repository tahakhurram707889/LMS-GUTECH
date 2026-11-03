import { beforeEach,describe,it,expect,vi } from 'vitest';
import request from 'supertest';
import type { Session } from '@supabase/supabase-js';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { AuthRepository } from '../src/repositories/auth.repository.js';
import { LmsService } from '../src/services/lms.service.js';
import { ApiError } from '../src/utils/api-error.js';
import type { Environment } from '../src/config/env.js';
const env:Environment={NODE_ENV:'test',PORT:4000,CLIENT_ORIGIN:'http://localhost:5173',SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_ANON_KEY:'test-anon-value-not-a-real-key',SUPABASE_SERVICE_ROLE_KEY:'test-service-value-not-a-real-key',PASSWORD_RESET_REDIRECT:'http://localhost:5173/reset-password',LOG_LEVEL:'silent'};
const profile={id:'10000000-0000-4000-8000-000000000004',full_name:'Noor',role:'student',is_active:true,must_change_password:true};
const session={access_token:'test-access-token',refresh_token:'test-refresh-token'} as Session;
beforeEach(()=>vi.restoreAllMocks());
describe('Authentication contracts',()=>{
  it('login returns the profile and access token while keeping refresh token httpOnly',async()=>{
    vi.spyOn(AuthService.prototype,'login').mockResolvedValue({session,profile});
    const response=await request(createApp(env)).post('/api/auth/login').send({username:'noor',password:'password'});
    expect(response.status).toBe(200);expect(response.body.data.profile.mustChangePassword).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(session.refresh_token);
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });
  it('returns a generic credentials error and applies five attempts per IP/username',async()=>{
    vi.spyOn(AuthService.prototype,'login').mockRejectedValue(new ApiError(401,'INVALID_CREDENTIALS','Invalid username or password'));
    const app=createApp(env);
    for(let i=0;i<5;i++){const response=await request(app).post('/api/auth/login').send({username:'unknown',password:'wrong'});expect(response.status).toBe(401);expect(response.body.error.message).toBe('Invalid username or password');}
    expect((await request(app).post('/api/auth/login').send({username:'unknown',password:'wrong'})).status).toBe(429);
  });
  it('refresh rotates its cookie and requires a trusted origin',async()=>{
    vi.spyOn(AuthService.prototype,'refresh').mockResolvedValue({session,profile});
    const response=await request(createApp(env)).post('/api/auth/refresh').set('Origin',env.CLIENT_ORIGIN).set('Cookie','refreshToken=test').send({});
    expect(response.status).toBe(200);expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect((await request(createApp(env)).post('/api/auth/refresh').send({})).status).toBe(401);
  });
  it('clears a rejected refresh cookie so browsers do not retry it on every reload',async()=>{
    vi.spyOn(AuthService.prototype,'refresh').mockRejectedValue(new ApiError(401,'UNAUTHORIZED','Your session has expired'));
    const response=await request(createApp(env)).post('/api/auth/refresh').set('Origin',env.CLIENT_ORIGIN).set('Cookie','refreshToken=expired-credential').send({});
    expect(response.status).toBe(401);
    expect(String(response.headers['set-cookie'])).toContain('Expires=');
    expect(JSON.stringify(response.body)).not.toContain('expired-credential');
  });
  it('forgot password has a neutral response and three requests per hour/email',async()=>{
    vi.spyOn(AuthService.prototype,'forgot').mockResolvedValue();const app=createApp(env);
    for(let i=0;i<3;i++){const response=await request(app).post('/api/auth/forgot-password').send({email:'unknown@example.test'});expect(response.status).toBe(200);expect(response.body.data.message).toMatch(/^If this account exists/);}
    expect((await request(app).post('/api/auth/forgot-password').send({email:'unknown@example.test'})).status).toBe(429);
  });
  it('reset accepts a single-use recovery hash and rejects incomplete input',async()=>{
    vi.spyOn(AuthService.prototype,'reset').mockResolvedValue();
    expect((await request(createApp(env)).post('/api/auth/reset-password').send({tokenHash:'recovery-hash-example',newPassword:'UpdatedPassword2026'})).status).toBe(200);
    expect((await request(createApp(env)).post('/api/auth/reset-password').send({newPassword:'short'})).status).toBe(422);
  });
  it('expired reset links return a clear error',async()=>{
    vi.spyOn(AuthService.prototype,'reset').mockRejectedValue(new ApiError(401,'EXPIRED_LINK','This reset link is invalid or expired. Request a new link.'));
    expect((await request(createApp(env)).post('/api/auth/reset-password').send({tokenHash:'recovery-hash-example',newPassword:'UpdatedPassword2026'})).body.error.code).toBe('EXPIRED_LINK');
  });
  it('password changes and logout require a verified active account',async()=>{
    vi.spyOn(AuthRepository.prototype,'identity').mockResolvedValue(session.user??{id:profile.id} as Session['user']);
    vi.spyOn(AuthRepository.prototype,'profile').mockResolvedValue(profile);
    vi.spyOn(AuthService.prototype,'change').mockResolvedValue();vi.spyOn(AuthService.prototype,'logout').mockResolvedValue();
    vi.spyOn(LmsService.prototype,'execute').mockResolvedValue({data:{id:profile.id,role:'student',mustChangePassword:true}});
    const app=createApp(env);
    expect((await request(app).get('/api/auth/me').set('Authorization','Bearer verified')).status).toBe(200);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/change-password').set('Authorization','Bearer verified').send({currentPassword:'old',newPassword:'UpdatedPassword2026'})).status).toBe(200);
    expect((await request(app).post('/api/auth/change-password').send({currentPassword:'old',newPassword:'UpdatedPassword2026'})).status).toBe(401);
    expect((await request(app).post('/api/auth/logout').set('Authorization','Bearer verified').send({})).status).toBe(204);
    const signedOut=await request(app).post('/api/auth/logout').send({});
    expect(signedOut.status).toBe(401);expect(String(signedOut.headers['set-cookie'])).toContain('Expires=');
    vi.spyOn(AuthRepository.prototype,'profile').mockRejectedValue(new ApiError(401,'UNAUTHORIZED','Account access is unavailable'));
    expect((await request(app).get('/api/auth/me').set('Authorization','Bearer old-token')).status).toBe(401);
  });
});
