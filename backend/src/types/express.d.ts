import type { SupabaseClient } from '@supabase/supabase-js';
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: 'admin' | 'teacher' | 'student'; mustChangePassword: boolean };
      db?: SupabaseClient;
      accessToken?: string;
    }
  }
}
export {};
