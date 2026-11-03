import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus,Pin } from 'lucide-react';
import { useCourse } from '../courses/context';
import { useSession } from '../auth/session';
import type { Announcement } from '../../lib/contracts';
import { mutate } from '../../lib/api';
import { Collection } from '../../components/ui/collection';
import { Modal } from '../../components/ui/modal';
import { Form,type Field } from '../../components/ui/forms';
import { Button } from '../../components/ui/button';
export function AnnouncementsPage(){
  const {courseId,courses}=useCourse(),{profile}=useSession(),cache=useQueryClient();const [open,setOpen]=useState(false),[selected,setSelected]=useState<Announcement|null>(null),[filter,setFilter]=useState(false),[error,setError]=useState('');
  const fields:Field[]=[{name:'courseId',label:'Audience',type:'select',options:[...(profile?.role==='admin'?[{value:'',label:'Global · everyone'}]:[]),...courses.map((c)=>({value:c.id,label:`${c.code} · ${c.title}`}))]},{name:'title',label:'Title'},{name:'body',label:'Announcement',type:'textarea'},{name:'isPinned',label:'Pin announcement',type:'select',options:[{value:'false',label:'No'},{value:'true',label:'Yes'}]}];
  const act=async(fn:()=>Promise<unknown>)=>{try{await fn();await cache.invalidateQueries();}catch(e){setError((e as Error).message);}};
  return <><div className="page-heading"><div><p className="eyebrow">FROM YOUR COMMUNITY</p><h1>Good things to know.</h1><p>Updates that keep everyone on the same page.</p></div><div className="row-actions"><Button variant="outline" onClick={()=>void act(()=>mutate('/announcements/read',{before:new Date().toISOString()}))}>Mark all read</Button>{profile?.role!=='student'&&<Button onClick={()=>{setSelected(null);setOpen(true);}}><Plus size={16}/> Post announcement</Button>}</div></div>
    <div className="filter-row"><button className={!filter?'selected':''} onClick={()=>setFilter(false)}>All updates</button><button className={filter?'selected':''} onClick={()=>setFilter(true)}>Current course</button></div>{error&&<p role="alert" className="error-banner">{error}</p>}
    <Collection<Announcement> path={filter?(courseId?`/announcements?courseId=${courseId}`:null):'/announcements'}>{(rows)=><div className="stack">{rows.map((a)=><article className="content-card" key={a.id}><div className="card-title-row"><span className="status-chip">{a.courseId?courses.find((c)=>c.id===a.courseId)?.code??'Course':'Campus-wide'}</span>{a.isPinned&&<span className="pinned"><Pin size={14}/> Pinned</span>}</div><h2>{a.title}</h2><p className="pre-wrap">{a.body}</p><small>{new Date(a.createdAt).toLocaleString()}</small>{(profile?.role==='admin'||a.authorId===profile?.id)&&<div className="row-actions"><Button variant="outline" onClick={()=>{setSelected(a);setOpen(true);}}>Edit</Button><Button variant="ghost" onClick={()=>{if(confirm('Delete announcement?'))void act(()=>mutate(`/announcements/${a.id}`,{},'DELETE'));}}>Delete</Button></div>}</article>)}</div>}</Collection>
    {open&&<Modal title={selected?'Edit announcement':'Post announcement'} onClose={()=>setOpen(false)}><Form fields={fields.map((f)=>f.name==='courseId'?{...f,required:false}:f)} initial={selected?{courseId:selected.courseId??'',title:selected.title,body:selected.body,isPinned:String(selected.isPinned)}:{courseId:profile?.role==='admin'?'':courseId,isPinned:'false'}} onSubmit={async(v)=>{await mutate(selected?`/announcements/${selected.id}`:'/announcements',{courseId:v.courseId||null,title:v.title,body:v.body,isPinned:v.isPinned==='true'},selected?'PATCH':'POST');setOpen(false);await cache.invalidateQueries();}}/></Modal>}
  </>;
}
