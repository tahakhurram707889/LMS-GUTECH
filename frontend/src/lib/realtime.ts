import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let instance:SupabaseClient|undefined;
/** Browser Supabase use is restricted to authenticated Realtime subscriptions. */
export function realtimeClient(){
  const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
  if(!url||!key||key.startsWith('replace-'))return undefined;
  instance??=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});return instance;
}
