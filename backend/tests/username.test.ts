import {beforeEach,describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import type {Session} from '@supabase/supabase-js';
import {createApp} from '../src/app.js';
import {AuthService} from '../src/services/auth.service.js';
import {AuthRepository} from '../src/repositories/auth.repository.js';
import {LoginRepository} from '../src/repositories/login.repository.js';
import {loginSchema} from '../src/schemas/auth.js';
import {userSchema} from '../src/schemas/lms.js';
import type {Environment} from '../src/config/env.js';
import {ApiError} from '../src/utils/api-error.js';
const env:Environment={NODE_ENV:'test',PORT:4000,CLIENT_ORIGIN:'http://localhost:5173',SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_ANON_KEY:'test-anon-value-not-a-real-key',SUPABASE_SERVICE_ROLE_KEY:'test-service-value-not-a-real-key',PASSWORD_RESET_REDIRECT:'http://localhost:5173/reset-password',LOG_LEVEL:'silent'};
const session={access_token:'access',refresh_token:'refresh',user:{id:'account-id'}} as Session;
beforeEach(()=>vi.restoreAllMocks());
describe('Username authentication boundaries',()=>{
  it('normalizes case and whitespace and rejects email or caller-selected roles',()=>{
    expect(loginSchema.parse({username:'  Noor.Ahmed ',password:'secret'}).username).toBe('noor.ahmed');
    expect(loginSchema.safeParse({email:'noor@example.test',password:'secret'}).success).toBe(false);
    expect(loginSchema.safeParse({username:'noor',password:'secret',role:'admin'}).success).toBe(false);
    expect(userSchema.safeParse({fullName:'Noor',email:'noor@example.test',role:'student',tempPassword:'Example2026!'}).success).toBe(false);
  });
  it.each(['admin','teacher','student'])('uses Supabase password verification and the trusted %s profile',async(role)=>{
    vi.spyOn(LoginRepository.prototype,'resolve').mockResolvedValue({id:'account-id',email:'internal@example.test'});
    const password=vi.spyOn(AuthRepository.prototype,'login').mockResolvedValue(session);
    vi.spyOn(AuthRepository.prototype,'profile').mockResolvedValue({id:'account-id',role,is_active:true});
    const result=await new AuthService(env).login('someone','secret');
    expect(password).toHaveBeenCalledWith('internal@example.test','secret');
    expect(result.profile.role).toBe(role);
  });
  it.each(['unknown','disabled'])('rejects %s usernames generically before creating a session',async(username)=>{
    vi.spyOn(LoginRepository.prototype,'resolve').mockResolvedValue(null);
    const login=vi.spyOn(AuthRepository.prototype,'login');
    await expect(new AuthService(env).login(username,'wrong')).rejects.toMatchObject({status:401,message:'Invalid username or password'});
    expect(login).not.toHaveBeenCalled();
  });
  it('revokes a new session when the resolved identity does not match',async()=>{
    vi.spyOn(LoginRepository.prototype,'resolve').mockResolvedValue({id:'different-id',email:'internal@example.test'});
    vi.spyOn(AuthRepository.prototype,'login').mockResolvedValue(session);
    vi.spyOn(AuthRepository.prototype,'profile').mockResolvedValue({id:'account-id',role:'student'});
    const logout=vi.spyOn(AuthRepository.prototype,'logout').mockResolvedValue();
    await expect(new AuthService(env).login('someone','secret')).rejects.toBeInstanceOf(ApiError);
    expect(logout).toHaveBeenCalledWith('access','local');
  });
  it('rejects role injection through the HTTP login contract',async()=>{
    const login=vi.spyOn(AuthService.prototype,'login');
    const response=await request(createApp(env)).post('/api/auth/login').send({username:'someone',password:'secret',role:'admin'});
    expect(response.status).toBe(422);expect(login).not.toHaveBeenCalled();
  });
});
