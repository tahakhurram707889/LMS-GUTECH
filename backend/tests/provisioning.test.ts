import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {AdminRepository} from '../src/repositories/admin.repository.js';
import {LoginRepository} from '../src/repositories/login.repository.js';
import type {Environment} from '../src/config/env.js';
vi.mock('@supabase/supabase-js',()=>({createClient:vi.fn()}));
const env={SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_SERVICE_ROLE_KEY:'server-only-test'} as Environment;
const input={fullName:'Test Teacher',username:'teacher.name',email:'teacher@example.test',role:'teacher',tempPassword:'Temporary2026!'};
function database(existing:unknown=null,profileError:unknown=null,cleanupError:unknown=null){
  const lookup={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:existing,error:null})};lookup.select.mockReturnValue(lookup);lookup.eq.mockReturnValue(lookup);
  const insert={select:vi.fn(),single:vi.fn().mockResolvedValue({data:profileError?null:{id:'new-id',username:input.username,role:'teacher'},error:profileError})};insert.select.mockReturnValue(insert);
  const builder={insert:vi.fn().mockReturnValue(insert)};
  const db={from:vi.fn().mockReturnValueOnce(lookup).mockReturnValue(builder),auth:{admin:{createUser:vi.fn().mockResolvedValue({data:{user:{id:'new-id'}},error:null}),deleteUser:vi.fn().mockResolvedValue({error:cleanupError})}}};
  vi.mocked(createClient).mockReturnValue(db as unknown as ReturnType<typeof createClient>);return {db,lookup,builder};
}
beforeEach(()=>vi.clearAllMocks());
describe('Private identity lookup and account provisioning',()=>{
  it('normalizes lookup and restricts it to active accounts',async()=>{
    const {lookup}=database({id:'existing',email:'private@example.test'});
    expect(await new LoginRepository(env).resolve(' Teacher.Name ')).toEqual({id:'existing',email:'private@example.test'});
    expect(lookup.select).toHaveBeenCalledWith('id,email');
    expect(lookup.eq).toHaveBeenCalledWith('username','teacher.name');expect(lookup.eq).toHaveBeenCalledWith('is_active',true);
  });
  it('checks username availability before creating an Auth identity',async()=>{
    const {db}=database({id:'existing'});
    await expect(new AdminRepository(env).createUser(input)).rejects.toMatchObject({status:409,code:'USERNAME_TAKEN'});
    expect(db.auth.admin.createUser).not.toHaveBeenCalled();
  });
  it('returns only the profile and links it to the Auth ID with a first-password gate',async()=>{
    const {builder}=database();const result=await new AdminRepository(env).createUser(input);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({id:'new-id',username:'teacher.name',role:'teacher',must_change_password:true}));
    expect(JSON.stringify(result)).not.toContain(input.tempPassword);
  });
  it('rolls back a new Auth identity if a concurrent username claim wins',async()=>{
    const {db}=database(null,{code:'23505'});
    await expect(new AdminRepository(env).createUser(input)).rejects.toMatchObject({status:409,code:'ACCOUNT_CONFLICT'});
    expect(db.auth.admin.deleteUser).toHaveBeenCalledWith('new-id');
  });
  it('reports incomplete compensation without leaking provider details',async()=>{
    database(null,{code:'23505'},{message:'sensitive provider details'});
    await expect(new AdminRepository(env).createUser(input)).rejects.toMatchObject({status:503,code:'ACCOUNT_CLEANUP_REQUIRED'});
  });
});
