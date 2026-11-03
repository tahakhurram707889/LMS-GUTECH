import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../utils/api-error.js';
import { toCamelCase } from './mapper.js';
type Filters = Record<string, string | boolean | number>;
export function databaseError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  const code = error.code ?? '';
  const status = code==='P0429' ? 429 : code==='42501' ? 403 : code==='P0002' || code==='PGRST116' ? 404 : code==='23505' || code==='P0001' ? 409 : code.startsWith('23') || code.startsWith('22') ? 422 : 500;
  const message = status===403 ? 'Access denied' : status===404 ? 'Item not found' : status===409 ? error.message ?? 'Operation conflicts with the current state' : status===422 ? 'Invalid data or constraint violation' : 'Database operation failed';
  throw new ApiError(status, status===429?'RATE_LIMITED':status===403?'FORBIDDEN':status===404?'NOT_FOUND':status===409?'CONFLICT':status===422?'VALIDATION_ERROR':'DATABASE_ERROR', status===429?'Message rate limit exceeded. Try again shortly.':message);
}
export class LmsRepository {
  constructor(readonly db: SupabaseClient) {}
  async one(table: string, id: string, column = 'id') {
    const { data, error } = await this.db.from(table).select('*').eq(column,id).single(); databaseError(error); return data!;
  }
  async list(table: string, filters: Filters, from: number, to: number, search?: { field: string; value: string }, order = 'created_at', ascending = false) {
    let query = this.db.from(table).select('*',{ count:'exact' });
    for (const [key,value] of Object.entries(filters)) query=query.eq(key,value);
    if (search?.value) query=query.ilike(search.field,`%${search.value.replace(/[%_\\]/g,'\\$&')}%`);
    const { data,error,count }=await query.order(order,{ ascending }).range(from,to); databaseError(error);
    return { data:data??[], total:count??0 };
  }
  async announcements(from: number,to: number,courseId?: string) {
    let query=this.db.from('announcements').select('*',{count:'exact'}).order('is_pinned',{ascending:false}).order('created_at',{ascending:false});
    if(courseId) query=query.eq('course_id',courseId);
    const {data,error,count}=await query.range(from,to);databaseError(error);return {data:data??[],total:count??0};
  }
  async insert(table: string, data: Record<string,unknown>, conflict?: string) {
    const q=conflict ? this.db.from(table).upsert(data,{onConflict:conflict}) : this.db.from(table).insert(data);
    const result=await q.select().single();databaseError(result.error);return result.data;
  }
  async update(table: string,id: string,data: Record<string,unknown>) {
    const result=await this.db.from(table).update(data).eq('id',id).select().single();databaseError(result.error);return result.data;
  }
  async removeEnrollment(courseId:string,studentId:string) {
    const {error}=await this.db.from('enrollments').delete().eq('course_id',courseId).eq('student_id',studentId);databaseError(error);
  }
  async enroll(courseId:string,ids:string[]) {
    if(!ids.length)return;
    const {error}=await this.db.from('enrollments').upsert(ids.map((studentId)=>({course_id:courseId,student_id:studentId})),{onConflict:'course_id,student_id',ignoreDuplicates:true});databaseError(error);
  }
  async emails(emails:string[]) {
    const {data,error}=await this.db.from('profiles').select('id,email').eq('role','student').eq('is_active',true).in('email',emails).limit(100);databaseError(error);return data??[];
  }
  async related(table:string,column:string,ids:string[],filters:Filters={}) {
    if(!ids.length)return [];
    let query=this.db.from(table).select('*').in(column,ids).limit(100);
    for(const [key,value] of Object.entries(filters))query=query.eq(key,value);
    const {data,error}=await query;databaseError(error);return data??[];
  }
  async rpc(name:string,args:Record<string,unknown>) {
    const {data,error}=await this.db.rpc(name,args);databaseError(error);return data;
  }
  async messages(courseId:string,before:string|undefined,limit:number) {
    let q=this.db.from('chat_messages').select('*').eq('course_id',courseId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit);
    if(before) q=q.lt('created_at',before);
    const {data,error}=await q;databaseError(error);return data??[];
  }
  async upload(bucket:string,path:string,buffer:Buffer,mime:string) {
    const {error}=await this.db.storage.from(bucket).upload(path,buffer,{contentType:mime,upsert:false});
    if(error)throw new ApiError(400,'UPLOAD_FAILED','File upload failed');
  }
  async removeFile(bucket:string,path:string) {
    const {error}=await this.db.storage.from(bucket).remove([path]);if(error)throw new ApiError(500,'STORAGE_ERROR','Could not remove file');
  }
  async download(bucket:string,path:string) {
    const {data,error}=await this.db.storage.from(bucket).createSignedUrl(path,60);if(error||!data)throw new ApiError(403,'FORBIDDEN','File access denied');return {url:data.signedUrl,expiresIn:60};
  }
  output(data:unknown) {return toCamelCase(data);}
}
