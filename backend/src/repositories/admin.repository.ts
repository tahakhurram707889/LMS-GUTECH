import { createClient } from '@supabase/supabase-js';
import type { Environment } from '../config/env.js';
import { databaseError } from './lms.repository.js';
import { ApiError } from '../utils/api-error.js';
import { supabaseFetch } from './supabase.js';
/** Instantiate only after the service verifies an admin principal. */
export class AdminRepository {
  private db;
  constructor(env:Environment) {this.db=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:supabaseFetch}});}
  async createUser(data:{fullName:string;username:string;email:string;role:string;tempPassword:string;rollNo?:string|null}) {
    const username=data.username.trim().toLowerCase();
    const existing=await this.db.from('profiles').select('id').eq('username',username).maybeSingle();
    databaseError(existing.error);
    if(existing.data)throw new ApiError(409,'USERNAME_TAKEN','This username is already assigned');
    const {data:created,error}=await this.db.auth.admin.createUser({email:data.email,password:data.tempPassword,email_confirm:true});
    if(error||!created.user)throw new ApiError(409,'ACCOUNT_ERROR','Could not create account. Check for duplicate email.');
    const profile=await this.db.from('profiles').insert({id:created.user.id,username,full_name:data.fullName,email:data.email,role:data.role,roll_no:data.role==='student'?data.rollNo??null:null,must_change_password:true}).select().single();
    if(profile.error){
      const rollback=await this.db.auth.admin.deleteUser(created.user.id);
      if(rollback.error)throw new ApiError(503,'ACCOUNT_CLEANUP_REQUIRED','Account provisioning failed. An operator must reconcile the unlinked Auth identity before retrying.');
      if(profile.error.code==='23505')throw new ApiError(409,'ACCOUNT_CONFLICT','Username, email or roll number is already assigned');
      databaseError(profile.error);
    }
    return profile.data;
  }
  async updateUser(id:string,data:Record<string,unknown>) {
    const {data:profile,error}=await this.db.from('profiles').update(data).eq('id',id).select().single();databaseError(error);return profile;
  }
  async audit(actorId:string,action:string,entityId:string) {
    const {error}=await this.db.from('audit_log').insert({actor_id:actorId,action,entity:'profiles',entity_id:entityId});databaseError(error);
  }
}
