import { useState,useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Plus,Clock3 } from 'lucide-react';
import { useCourse } from '../courses/context';
import { useSession } from '../auth/session';
import { api,apiPage,mutate } from '../../lib/api';
import { upload } from '../../lib/upload';
import type { Assignment,Submission,Member } from '../../lib/contracts';
import { Collection } from '../../components/ui/collection';
import { Modal } from '../../components/ui/modal';
import { Form,type Field } from '../../components/ui/forms';
import { Button } from '../../components/ui/button';
import { FilePicker } from '../../components/ui/file-picker';
const fields:Field[]=[{name:'title',label:'Assignment title'},{name:'instructions',label:'Instructions',type:'textarea'},{name:'maxMarks',label:'Maximum marks',type:'number'},{name:'dueAt',label:'Due date',type:'datetime-local'},{name:'allowLate',label:'Allow late submissions',type:'select',options:[{value:'false',label:'No'},{value:'true',label:'Yes'}]}];
function SubmitWork({assignment,onDone}:{assignment:Assignment;onDone:()=>void}){
  const [file,setFile]=useState<File|null>(null),[progress,setProgress]=useState<number>();
  return <><p className="pre-wrap">{assignment.instructions}</p><p className="muted">Due {new Date(assignment.dueAt).toLocaleString()} · {assignment.maxMarks} marks</p><Form fields={[{name:'textAnswer',label:'Your answer',type:'textarea',required:false}]} initial={{textAnswer:assignment.submission?.textAnswer??''}} submit={assignment.submission?'Resubmit work':'Submit work'} onSubmit={async(v)=>{
    let filePath=assignment.submission?.filePath??undefined;
    if(file){const data=new FormData();data.append('file',file);const uploaded=await upload<{filePath:string}>(`/assignments/${assignment.id}/upload`,data,setProgress);filePath=uploaded.filePath;}
    if(!v.textAnswer?.trim()&&!filePath)throw new Error('Provide an answer or attachment');
    await mutate(`/assignments/${assignment.id}/submission`,{textAnswer:v.textAnswer,filePath},'PUT');onDone();
  }}><FilePicker file={file} onChange={setFile} progress={progress}/><small className="muted">Resubmission replaces your previous answer and clears its grade.</small></Form>{assignment.submission?.feedback&&<div className="feedback-note"><strong>Teacher feedback</strong><p>{assignment.submission.feedback}</p></div>}</>;
}
function GradeWork({assignment}:{assignment:Assignment}){
  const {courseId}=useCourse(),cache=useQueryClient();const [error,setError]=useState('');
  const members=useQuery({queryKey:['members',courseId],queryFn:()=>apiPage<Member>(`/courses/${courseId}/members?pageSize=100`)});
  return <><p className="muted">Maximum {assignment.maxMarks} marks. Save each student’s grade to release it.</p>{error&&<p role="alert">{error}</p>}<Collection<Submission> path={`/assignments/${assignment.id}/submissions`}>{(rows)=><div className="stack">{rows.map((s)=><article className="grading-card" key={s.id}><h3>{s.studentName??members.data?.data.find((m)=>m.id===s.studentId)?.fullName??'Student'}</h3><p className="pre-wrap">{s.textAnswer}</p><span className="status-chip">{s.isLate?'Late submission':'On time'}</span>{s.filePath&&<Button variant="outline" onClick={async()=>{try{const {url}=await api<{url:string}>(`/submissions/${s.id}/download`);window.open(url,'_blank','noopener,noreferrer');}catch(e){setError((e as Error).message);}}}>Download attachment</Button>}
    <Form key={`${s.id}-${s.marksObtained}`} fields={[{name:'marks',label:'Marks',type:'number'},{name:'feedback',label:'Feedback',type:'textarea',required:false}]} initial={{marks:s.marksObtained===null?'':String(s.marksObtained),feedback:s.feedback??''}} submit="Save grade" onSubmit={async(v)=>{await mutate(`/submissions/${s.id}/grade`,{marks:Number(v.marks),feedback:v.feedback??''},'PATCH');await cache.invalidateQueries();}}/>
  </article>)}</div>}</Collection></>;
}
export function AssignmentsPage(){
  const {courseId}=useCourse(),{profile}=useSession(),cache=useQueryClient();const [mode,setMode]=useState<'create'|'edit'|'submit'|'grade'|null>(null),[selected,setSelected]=useState<Assignment|null>(null),[error,setError]=useState('');
  const [attachment,setAttachment]=useState<File|null>(null),[uploadProgress,setUploadProgress]=useState<number>(),[now,setNow]=useState(Date.now());
  useEffect(()=>{const clock=setInterval(()=>setNow(Date.now()),60_000);return()=>clearInterval(clock);},[]);
  const staff=profile?.role!=='student';const [params,setParams]=useSearchParams();const gradeId=params.get('grade');
  const target=useQuery({queryKey:['grade-target',gradeId],queryFn:()=>api<Assignment>(`/assignments/${gradeId}`),enabled:!!gradeId&&staff});
  useEffect(()=>{if(target.data){setSelected(target.data);setMode('grade');}},[target.data]);
  const done=()=>{setMode(null);setParams({});void cache.invalidateQueries();};
  return <><div className="page-heading"><div><p className="eyebrow">PUT LEARNING INTO PRACTICE</p><h1>Work that moves you forward.</h1><p>Assignments, submissions, and thoughtful feedback.</p></div>{staff&&<Button disabled={!courseId} onClick={()=>{setSelected(null);setMode('create');}}><Plus size={16}/> Create assignment</Button>}</div>{error&&<p role="alert" className="error-banner">{error}</p>}
    <Collection<Assignment> path={courseId?`/courses/${courseId}/assignments`:null}>{(rows)=><div className="stack">{rows.map((a)=><article className="content-card" key={a.id}><div className="card-title-row"><h2>{a.title}</h2><span className="status-chip">{a.submission?.marksObtained!=null?'Graded':a.submission?(a.submission.isLate?'Late':'Submitted'):'Pending'}</span></div><p className="pre-wrap">{a.instructions}</p><div className="assignment-meta"><span><Clock3 size={14}/> {new Date(a.dueAt).toLocaleString()}</span><span>{a.maxMarks} marks</span><span>{new Date(a.dueAt).getTime()<=now?'Deadline passed':`${Math.floor((new Date(a.dueAt).getTime()-now)/86400000)}d ${Math.floor((new Date(a.dueAt).getTime()-now)/3600000)%24}h ${Math.ceil((new Date(a.dueAt).getTime()-now)/60000)%60}m remaining`}</span>{a.allowLate&&<span>Late work accepted</span>}{a.submission?.marksObtained!=null&&<strong>{a.submission.marksObtained}/{a.maxMarks}</strong>}</div>
      <div className="row-actions">{a.attachmentPath&&<Button variant="outline" onClick={async()=>{try{const {url}=await api<{url:string}>(`/assignments/${a.id}/attachment`);window.open(url,'_blank','noopener,noreferrer');}catch(e){setError((e as Error).message);}}}>Assignment attachment</Button>}<Button onClick={()=>{setSelected(a);setMode(staff?'grade':'submit');}}>{staff?'Grade submissions':a.submission?'View / resubmit':'Open assignment'}</Button>{staff&&<><Button variant="outline" onClick={()=>{setSelected(a);setMode('edit');}}>Edit</Button><Button variant="ghost" onClick={async()=>{if(!confirm('Delete assignment and its submissions?'))return;try{await mutate(`/assignments/${a.id}`,{},'DELETE');await cache.invalidateQueries();}catch(e){setError((e as Error).message);}}}>Delete</Button></>}</div></article>)}</div>}</Collection>
    {mode&&<Modal title={mode==='submit'?'Your assignment':mode==='grade'?'Grade submissions':mode==='edit'?'Edit assignment':'Create assignment'} onClose={done}>
      {(mode==='create'||mode==='edit')?<Form fields={fields} initial={selected?{title:selected.title,instructions:selected.instructions,maxMarks:String(selected.maxMarks),dueAt:new Date(new Date(selected.dueAt).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16),allowLate:String(selected.allowLate)}:{allowLate:'false'}} onSubmit={async(v)=>{let attachmentPath=selected?.attachmentPath??undefined;if(attachment){const data=new FormData();data.append('file',attachment);attachmentPath=(await upload<{filePath:string}>(`/courses/${courseId}/assignment-attachments`,data,setUploadProgress)).filePath;}await mutate(mode==='edit'?`/assignments/${selected!.id}`:`/courses/${courseId}/assignments`,{...v,attachmentPath,maxMarks:Number(v.maxMarks),dueAt:new Date(v.dueAt!).toISOString(),allowLate:v.allowLate==='true'},mode==='edit'?'PATCH':'POST');setAttachment(null);done();}}><FilePicker file={attachment} onChange={setAttachment} progress={uploadProgress}/></Form>:mode==='submit'&&selected?<SubmitWork assignment={selected} onDone={done}/>:selected?<GradeWork assignment={selected}/>:null}
    </Modal>}
  </>;
}
