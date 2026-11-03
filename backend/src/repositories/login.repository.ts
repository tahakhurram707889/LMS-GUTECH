import { createClient } from '@supabase/supabase-js';
import type { Environment } from '../config/env.js';
import { supabaseFetch } from './supabase.js';
import { profileDatabaseError } from '../utils/auth-errors.js';

/** Private username lookup only. Never return the resolved email to the caller. */
export class LoginRepository {
  constructor(private env: Environment) {}
  async resolve(username: string): Promise<{id:string;email:string} | null> {
    const db = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: supabaseFetch },
    });
    const {data,error} = await db.from('profiles').select('id,email').eq('username', username.trim().toLowerCase()).eq('is_active',true).maybeSingle();
    profileDatabaseError(error);
    return data;
  }
}
