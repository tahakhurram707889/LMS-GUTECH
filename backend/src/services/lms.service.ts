import type { SupabaseClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { Environment } from '../config/env.js';
import { LmsRepository } from '../repositories/lms.repository.js';
import { AdminRepository } from '../repositories/admin.repository.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import { paginationRange } from '../schemas/pagination.js';
import { userSchema } from '../schemas/lms.js';
import { uploadFile } from './files.service.js';
import { ApiError } from '../utils/api-error.js';
import { csvDocument } from '../utils/csv.js';
type Principal={id:string;role:'admin'|'teacher'|'student'};
export type Command={user:Principal;db:SupabaseClient;token:string;params:Record<string,string>;query:Record<string,unknown>;body:unknown;file?:Express.Multer.File};
export class LmsService {
  constructor(private env:Environment){}
  async execute(operation:string,ctx:Command):Promise<unknown> {
    const repo=new LmsRepository(ctx.db);const body=(ctx.body??{}) as Record<string,unknown>;
    const key=ctx.params.id??'';const range=paginationRange(ctx.query);
    const courseId=typeof ctx.query.courseId==='string'?z.string().uuid().parse(ctx.query.courseId):undefined;
    const search=typeof ctx.query.search==='string'?z.string().max(180).parse(ctx.query.search):'';
    const requireAdmin=()=>{if(ctx.user.role!=='admin')throw new ApiError(403,'FORBIDDEN','Admin access required');};
    const courseAccess=async(manage=false)=>{
      if(!await repo.rpc(manage?'can_manage_course':'can_read_course',{course_id:key}))throw new ApiError(403,'FORBIDDEN','Course access denied');
    };
    const paged=(data:unknown,total:number)=>({data:repo.output(data),meta:{page:range.page,pageSize:range.pageSize,total}});
    const result=(data:unknown)=>({data:repo.output(data)});
    const labels=async(course:string,ids:string[])=>await repo.rpc('member_labels',{p_course:course,p_ids:[...new Set(ids)]}) as {id:string;full_name:string;role:string}[];
    const mutate=async(fn:string,action:string,data:unknown=body)=>result(await repo.rpc(fn,{p_action:action,p_id:key||null,p_data:data}));

    if(operation==='profile.get')return result(await repo.one('profiles',ctx.user.id));
    if(operation==='profile.patch')return result(await repo.update('profiles',ctx.user.id,{full_name:body.fullName}));
    if(operation==='profile.metrics')return result(await repo.rpc('my_metrics',{}));
    if(operation==='dashboard.summary')return result(await repo.rpc('dashboard_summary',{}));
    if(operation==='departments.list'){requireAdmin();const page=await repo.list('departments',{},range.from,range.to,{field:'name',value:search});return paged(page.data,page.total);}
    if(operation==='departments.create'||operation==='departments.patch'){requireAdmin();return result(operation.endsWith('create')?await repo.insert('departments',body):await repo.update('departments',key,body));}
    if(operation==='admin.users.create'){
      requireAdmin();const admin=new AdminRepository(this.env);const created=await admin.createUser(userSchema.parse(body));
      await admin.audit(ctx.user.id,'user.create',created.id);return result(created);
    }
    if(operation==='admin.users.patch'){
      requireAdmin();if(key===ctx.user.id&&(body.isActive===false||body.role&&body.role!=='admin'))throw new ApiError(409,'CONFLICT','You cannot deactivate or demote your own account');
      const admin=new AdminRepository(this.env);
      const fields:Record<string,unknown>={};for(const [source,target]of Object.entries({fullName:'full_name',username:'username',role:'role',rollNo:'roll_no',isActive:'is_active'})){if(source in body)fields[target]=body[source];}
      if(body.role&&body.role!=='student')fields.roll_no=null;
      const updated=await admin.updateUser(key,fields);await admin.audit(ctx.user.id,'user.update',key);return result(updated);
    }
    if(operation==='admin.users.reset'){
      requireAdmin();const target=await repo.one('profiles',key);await new AuthRepository(this.env).forgot(target.email);await new AdminRepository(this.env).audit(ctx.user.id,'user.reset_requested',key);return result({message:'Password reset email requested'});
    }
    if(operation==='admin.users.list'){
      requireAdmin();const filters:Record<string,string>={};if(ctx.query.role)filters.role=z.enum(['admin','teacher','student']).parse(ctx.query.role);
      const page=await repo.list('profiles',filters,range.from,range.to,{field:'full_name',value:search});return paged(page.data,page.total);
    }
    if(operation==='courses.list'||operation==='admin.courses.list'){
      if(operation.startsWith('admin.'))requireAdmin();
      const page=await repo.list('courses',operation==='courses.list'?{is_archived:false}:{},range.from,range.to,{field:'title',value:search});return paged(page.data,page.total);
    }
    if(operation==='admin.courses.create'||operation==='admin.courses.patch'){
      requireAdmin();const fields={code:body.code,title:body.title,description:body.description,is_archived:body.isArchived,...('departmentId' in body?{department_id:body.departmentId}:{})};
      return result(operation.endsWith('create')?await repo.insert('courses',fields):await repo.update('courses',key,fields));
    }
    if(operation==='course.members') {await courseAccess();const rows=await repo.rpc('course_members',{p_course:key,p_page:range.page,p_size:range.pageSize});return paged(rows,Number(await repo.rpc('course_member_count',{p_course:key})));}
    if(operation==='course.teacher-list'){requireAdmin();const page=await repo.list('course_teachers',{course_id:key},range.from,range.to);return paged(page.data,page.total);}
    if(operation==='course.enrollments'){
      requireAdmin();const page=await repo.list('enrollments',{course_id:key},range.from,range.to);
      const profiles=await repo.related('profiles','id',page.data.map((e)=>e.student_id));return paged(profiles,page.total);
    }
    if(operation==='course.teachers') {requireAdmin();return mutate('learning_write','teachers.replace');}
    if(operation==='course.enroll') {requireAdmin();await repo.enroll(key,body.studentIds as string[]);return result({message:'Students enrolled'});}
    if(operation==='course.unenroll') {requireAdmin();await repo.removeEnrollment(key,ctx.params.studentId!);return result({message:'Student unenrolled'});}
    if(operation==='course.csv') {
      requireAdmin();let records:unknown;
      try{records=parse(String(body.csv),{columns:true,skip_empty_lines:true,trim:true,max_record_size:1024});}catch{throw new ApiError(422,'INVALID_CSV','CSV must have an email header and valid rows');}
      const emails=z.array(z.object({email:z.string().email().transform((s)=>s.toLowerCase())})).min(1).max(100).parse(records).map((r)=>r.email);
      const unique=[...new Set(emails)],matched=await repo.emails(unique),known=new Set(matched.map((p)=>p.email));
      const existing=await repo.related('enrollments','student_id',matched.map((p)=>p.id),{course_id:key});
      const enrolled=new Set(existing.map((r)=>r.student_id));
      if(!body.preview)await repo.enroll(key,matched.filter((p)=>!enrolled.has(p.id)).map((p)=>p.id));
      return result({matched:matched.map((p)=>p.email),duplicates:unique.filter((e)=>emails.filter((x)=>x===e).length>1||matched.some((p)=>p.email===e&&enrolled.has(p.id))),unknown:unique.filter((e)=>!known.has(e)),preview:body.preview});
    }
    const courseLists:Record<string,string>={'resources.list':'resources','assignments.list':'assignments','quizzes.list':'quizzes'};
    if(operation in courseLists){
      await courseAccess();const table=courseLists[operation]!;const page=await repo.list(table,{course_id:key},range.from,range.to,{field:'title',value:search});
      if(ctx.user.role==='student'&&table==='assignments'){
        const own=await repo.related('submissions','assignment_id',page.data.map((r)=>r.id),{student_id:ctx.user.id});
        page.data=page.data.map((r)=>({...r,submission:own.find((s)=>s.assignment_id===r.id)??null}));
      }
      if(ctx.user.role==='student'&&table==='quizzes'){
        const own=await repo.related('quiz_attempts','quiz_id',page.data.map((r)=>r.id),{student_id:ctx.user.id});
        page.data=page.data.map((r)=>({...r,attempt:own.find((s)=>s.quiz_id===r.id)??null}));
      }
      return paged(page.data,page.total);
    }
    if(operation==='resource.upload'){
      await courseAccess(true);if(!ctx.file)throw new ApiError(422,'FILE_REQUIRED','Choose a file');
      const file=await uploadFile(repo,'resources',`${key}/${ctx.user.id}`,ctx.file);
      try{return await mutate('community_write','resource.create',{...body,...file,courseId:key});}
      catch(error){await repo.removeFile('resources',file.filePath).catch(()=>{});throw error;}
    }
    if(operation==='resource.download'||operation==='resource.delete'){
      const resource=await repo.one('resources',key);
      if(operation.endsWith('download'))return result(await repo.download('resources',resource.file_path));
      if(ctx.user.role!=='admin'&&resource.uploaded_by!==ctx.user.id)throw new ApiError(403,'FORBIDDEN','Only uploader or admin can delete this resource');
      await repo.removeFile('resources',resource.file_path);return mutate('community_write','resource.delete');
    }
    if(operation==='submission.upload'){
      const assignment=await repo.one('assignments',key);
      if(!await repo.rpc('is_enrolled',{course_id:assignment.course_id}))throw new ApiError(403,'FORBIDDEN','Enrollment required');
      if(!ctx.file)throw new ApiError(422,'FILE_REQUIRED','Choose a file');
      return result(await uploadFile(repo,'submissions',`${assignment.course_id}/${ctx.user.id}`,ctx.file));
    }
    if(operation==='assignment.attachment.upload'){
      await courseAccess(true);if(!ctx.file)throw new ApiError(422,'FILE_REQUIRED','Choose a file');
      return result(await uploadFile(repo,'resources',`${key}/${ctx.user.id}`,ctx.file));
    }
    if(operation==='assignment.attachment.download'){
      const assignment=await repo.one('assignments',key);if(!assignment.attachment_path)throw new ApiError(404,'NOT_FOUND','No attachment');
      return result(await repo.download('resources',assignment.attachment_path));
    }
    if(operation==='submission.download') {const submission=await repo.one('submissions',key);if(!submission.file_path)throw new ApiError(404,'NOT_FOUND','No attachment');return result(await repo.download('submissions',submission.file_path));}
    if(operation==='assignments.create')return mutate('learning_write','assignment.create',{...body,courseId:key});
    if(operation==='assignment.detail')return result(await repo.one('assignments',key));
    if(operation==='assignments.patch')return mutate('learning_write','assignment.update');
    if(operation==='assignments.delete')return mutate('learning_write','assignment.delete');
    if(operation==='submission.put')return mutate('learning_write','submission.put');
    if(operation==='submission.grade')return mutate('learning_write','submission.grade');
    if(operation==='submissions.list'){
      const a=await repo.one('assignments',key);if(!await repo.rpc('can_manage_course',{course_id:a.course_id}))throw new ApiError(403,'FORBIDDEN','Teacher access required');
      const page=await repo.list('submissions',{assignment_id:key},range.from,range.to);const names=await labels(a.course_id,page.data.map((r)=>r.student_id));return paged(page.data.map((r)=>({...r,student_name:names.find((n)=>n.id===r.student_id)?.full_name??'Student'})),page.total);
    }
    if(operation==='quizzes.create')return mutate('learning_write','quiz.create',{...body,courseId:key});
    if(operation==='quizzes.patch')return mutate('learning_write','quiz.update');
    if(operation==='quizzes.detail'){
      const quiz=await repo.one('quizzes',key);if(!await repo.rpc('can_manage_course',{course_id:quiz.course_id}))throw new ApiError(403,'FORBIDDEN','Teacher access required');
      const questions=await repo.list('quiz_questions',{quiz_id:key},0,99,undefined,'position',true);
      const answers=await repo.related('quiz_answers','question_id',questions.data.map((q)=>q.id));return result({...quiz,questions:questions.data.map((q)=>({...q,correct_option_ids:answers.find((a)=>a.question_id===q.id)?.correct_option_ids??[]}))});
    }
    if(operation==='attempt.start')return mutate('learning_write','attempt.start');
    if(operation==='attempt.submit')return mutate('learning_write','attempt.submit');
    if(operation==='attempt.resume'){
      const attempts=await repo.related('quiz_attempts','quiz_id',[key],{student_id:ctx.user.id});const attempt=attempts[0];
      if(!attempt)throw new ApiError(404,'NOT_FOUND','No attempt');const quiz=await repo.one('quizzes',key);
      const questions=await repo.list('quiz_questions',{quiz_id:key},0,99,undefined,'position',true);
      return result({...attempt,expires_at:new Date(Math.min(new Date(quiz.closes_at).getTime(),new Date(attempt.started_at).getTime()+quiz.time_limit_minutes*60000)).toISOString(),questions:questions.data});
    }
    if(operation==='quizzes.results'){
      const quiz=await repo.one('quizzes',key);if(!await repo.rpc('can_manage_course',{course_id:quiz.course_id}))throw new ApiError(403,'FORBIDDEN','Teacher access required');
      const page=await repo.list('quiz_attempts',{quiz_id:key},range.from,range.to);const names=await labels(quiz.course_id,page.data.map((r)=>r.student_id));return paged(page.data.map((r)=>({...r,student_name:names.find((n)=>n.id===r.student_id)?.full_name??'Student'})),page.total);
    }
    if(operation==='announcements.list'){const page=await repo.announcements(range.from,range.to,courseId);return paged(page.data,page.total);}
    if(operation==='announcements.create')return mutate('community_write','announcement.create');
    if(operation==='announcements.patch')return mutate('community_write','announcement.update');
    if(operation==='announcements.delete')return mutate('community_write','announcement.delete');
    if(operation==='announcements.read')return mutate('community_write','announcement.read');
    if(operation==='marks.list'){
      if(ctx.user.role!=='student')throw new ApiError(403,'FORBIDDEN','Student access required');
      if(ctx.query.studentId&&ctx.query.studentId!==ctx.user.id)throw new ApiError(403,'FORBIDDEN','Only your own marks are available');
      const filters:Record<string,string>={student_id:ctx.user.id};if(courseId)filters.course_id=courseId;
      const page=await repo.list('v_student_marks',filters,range.from,range.to,undefined,'title',true);
      return {...paged(page.data,page.total),summary:await repo.rpc('marks_summary',{p_course:courseId??null})};
    }
    if(operation==='gradebook'||operation==='gradebook.csv'){
      await courseAccess(true);
      if(operation==='gradebook')return result(await repo.rpc('gradebook_page',{p_course:key,p_page:range.page,p_size:range.pageSize}));
      const rows:unknown[][]=[['Student','Roll number','Type','Item','Obtained','Maximum']];
      for(let page=1;;page++){
        const book=await repo.rpc('gradebook_page',{p_course:key,p_page:page,p_size:100}) as {items:{id:string;kind:string;title:string;maximum:number}[];students:{name:string;roll_no:string;marks:{item_id:string;obtained:number|null}[]}[];total:number};
        for(const student of book.students)for(const item of book.items){const mark=student.marks.find((m)=>m.item_id===item.id);rows.push([student.name,student.roll_no,item.kind,item.title,mark?.obtained??'Pending',item.maximum]);}
        if(page*100>=book.total)break;
      }
      return {csv:csvDocument(rows)};
    }
    if(operation==='messages.list'){
      await courseAccess();const before=ctx.query.before?z.string().datetime({offset:true}).parse(ctx.query.before):undefined;
      const limit=z.coerce.number().int().min(1).max(100).default(50).parse(ctx.query.limit);
      const rows=await repo.messages(key,before,limit);const names=await labels(key,rows.map((r)=>r.sender_id));return {data:repo.output(rows.map((r)=>({...r,sender_name:names.find((n)=>n.id===r.sender_id)?.full_name??'Course member',sender_role:names.find((n)=>n.id===r.sender_id)?.role??''}))),meta:{nextCursor:rows.length===limit?rows[rows.length-1]?.created_at:null}};
    }
    if(operation==='messages.create')return mutate('community_write','message.send');
    if(operation==='messages.delete')return mutate('community_write','message.delete');
    if(operation==='complaints.create'){
      let file:Awaited<ReturnType<typeof uploadFile>>|undefined;
      if(ctx.file)file=await uploadFile(repo,'complaint-attachments',ctx.user.id,ctx.file);
      try{return await mutate('community_write','complaint.create',{...body,attachmentPath:file?.filePath});}
      catch(error){if(file)await repo.removeFile('complaint-attachments',file.filePath).catch(()=>{});throw error;}
    }
    if(operation==='complaints.mine'||operation==='admin.complaints'){
      const filters:Record<string,string>={};if(operation==='complaints.mine')filters.raised_by=ctx.user.id;else requireAdmin();
      if(ctx.query.status)filters.status=z.enum(['open','in_review','resolved','rejected']).parse(ctx.query.status);
      if(ctx.query.category)filters.category=z.enum(['academic','technical','facility','conduct','other']).parse(ctx.query.category);
      const page=await repo.list('complaints',filters,range.from,range.to);return paged(page.data,page.total);
    }
    if(operation==='complaints.review'){requireAdmin();return mutate('community_write','complaint.review');}
    if(operation==='complaints.download'){const complaint=await repo.one('complaints',key);if(!complaint.attachment_path)throw new ApiError(404,'NOT_FOUND','No attachment');return result(await repo.download('complaint-attachments',complaint.attachment_path));}
    if(operation==='notifications.list'){const page=await repo.list('notifications',{user_id:ctx.user.id},range.from,range.to);return paged(page.data,page.total);}
    if(operation==='notifications.counts')return result(await repo.rpc('unread_counts',{}));
    if(operation==='notifications.read')return mutate('community_write','notification.read');
    throw new ApiError(404,'NOT_FOUND','Operation not found');
  }
}
