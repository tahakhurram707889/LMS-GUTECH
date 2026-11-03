import { readFileSync } from 'node:fs';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import request from 'supertest';
import type { User } from '@supabase/supabase-js';
import { createApp } from '../src/app.js';
import { AuthRepository } from '../src/repositories/auth.repository.js';
import { LmsService } from '../src/services/lms.service.js';
import type { Environment } from '../src/config/env.js';
import { csvDocument } from '../src/utils/csv.js';
const uuid='10000000-0000-4000-8000-000000000004';
const env:Environment={NODE_ENV:'test',PORT:4000,CLIENT_ORIGIN:'http://localhost:5173',SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_ANON_KEY:'test-anon-value-not-a-real-key',SUPABASE_SERVICE_ROLE_KEY:'test-service-value-not-a-real-key',PASSWORD_RESET_REDIRECT:'http://localhost:5173/reset-password',LOG_LEVEL:'silent'};
// Exercise real middleware, schemas, controller dispatch and HTTP contracts. The
// service is mocked here; live business rules are covered separately by pgTAP.
beforeEach(()=>{
  vi.restoreAllMocks();
  vi.spyOn(AuthRepository.prototype,'identity').mockImplementation(async()=>({id:uuid} as User));
  vi.spyOn(AuthRepository.prototype,'profile').mockImplementation(async(token)=>({id:uuid,role:token,full_name:'Test User',email:'test@example.test',is_active:true,must_change_password:false}));
  vi.spyOn(LmsService.prototype,'execute').mockResolvedValue({data:[],csv:'\uFEFFStudent,Score'});
});
const source=readFileSync(new URL('../src/routes/lms.routes.ts',import.meta.url),'utf8');
const routes=[...source.matchAll(/route\('(get|post|put|patch|delete)','([^']+)','([^']+)'([^;]*?)\);/g)].map((m)=>{
  const tail=m[4]??'';
  const roles=tail.includes(',admin')?['admin']:tail.includes(',staff')?['admin','teacher']:tail.includes(',student')?['student']:tail.includes("['teacher','student']")?['teacher','student']:undefined;
  return {method:m[1] as 'get'|'post'|'put'|'patch'|'delete',path:m[2]!.replace(':id',uuid).replace(':studentId',uuid),operation:m[3]!,roles,file:tail.endsWith(',true')};
});
const assignment={title:'Search analysis',instructions:'Describe binary search',maxMarks:20,dueAt:'2030-01-01T12:00:00Z',allowLate:false};
const quiz={title:'Search quiz',description:'Check your understanding',timeLimitMinutes:10,opensAt:'2030-01-01T10:00:00Z',closesAt:'2030-01-01T11:00:00Z',isPublished:true,questions:[{position:0,type:'mcq_single',prompt:'Pick one',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correctOptionIds:['b'],marks:1}]};
const fixtures:Record<string,unknown>={
  'departments.create':{code:'CS',name:'Computer Science'},'departments.patch':{code:'CS',name:'Computing'},
  'profile.patch':{fullName:'Updated Name'},'admin.users.create':{fullName:'Test User',email:'test@example.test',username:'test.user',role:'student',tempPassword:'ExamplePass2026'},'admin.users.patch':{isActive:false},
  'admin.courses.create':{code:'CS102',title:'Computing'},'admin.courses.patch':{code:'CS102',title:'Computing',isArchived:true},'course.teachers':{teacherIds:[uuid]},'course.enroll':{studentIds:[uuid]},'course.csv':{csv:'email\ntest@example.test',preview:true},
  'resource.upload':{title:'Lecture notes'},'assignments.create':assignment,'assignments.patch':assignment,'submission.put':{textAnswer:'My answer'},'submission.grade':{marks:10,feedback:'Good work'},
  'quizzes.create':quiz,'quizzes.patch':quiz,'attempt.submit':{answers:{[uuid]:['b']}},'announcements.create':{courseId:uuid,title:'Update',body:'A course update',isPinned:true},'announcements.patch':{title:'Updated',body:'Updated announcement'},'announcements.read':{before:'2030-01-01T12:00:00Z'},'messages.create':{body:'Hello classroom'},'complaints.create':{category:'technical',subject:'Projector',description:'Needs maintenance'},'complaints.review':{status:'in_review',adminResponse:''},
};
describe('Every registered LMS endpoint',()=>{
  for(const route of routes){
    it(`${route.method.toUpperCase()} ${route.path} accepts a validated authorized request`,async()=>{
      const req=request(createApp(env))[route.method](`/api${route.path}`).set('Authorization',`Bearer ${route.roles?.[0]??'student'}`);
      const body=fixtures[route.operation]??{};
      if(route.file){for(const [key,value]of Object.entries(body as Record<string,string>))req.field(key,value);req.attach('file',Buffer.from('%PDF-1.4\nfixture'),{filename:'notes.pdf',contentType:'application/pdf'});}else if(route.method!=='get')req.send(body);
      expect((await req).status).toBe(200);
    });
    it(`${route.method.toUpperCase()} ${route.path} denies unauthenticated requests`,async()=>{
      expect((await request(createApp(env))[route.method](`/api${route.path}`)).status).toBe(401);
    });
    if(route.roles)it(`${route.operation} rejects a wrong role before its service`,async()=>{
      const role=['student','teacher','admin'].find((r)=>!route.roles!.includes(r));if(!role)return;
      const response=await request(createApp(env))[route.method](`/api${route.path}`).set('Authorization',`Bearer ${role}`);
      expect(response.status).toBe(403);expect(LmsService.prototype.execute).not.toHaveBeenCalled();
    });
  }
  it('blocks temporary-password users from the feature API',async()=>{
    vi.spyOn(AuthRepository.prototype,'profile').mockResolvedValue({id:uuid,role:'student',is_active:true,must_change_password:true});
    expect((await request(createApp(env)).get('/api/me/courses').set('Authorization','Bearer student')).status).toBe(403);
  });
  it('escapes CSV formulas, quotes and emits an Excel UTF-8 BOM',()=>{
    expect(csvDocument([['=HYPERLINK("bad")','a,b',16]])).toBe('\uFEFF"\'=HYPERLINK(""bad"")","a,b","16"');
  });
});
