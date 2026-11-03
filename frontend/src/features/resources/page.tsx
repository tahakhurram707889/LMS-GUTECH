import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download,FileText,Plus,Trash2 } from 'lucide-react';
import { useCourse } from '../courses/context';
import { useSession } from '../auth/session';
import type { Resource } from '../../lib/contracts';
import { api,mutate } from '../../lib/api';
import { upload } from '../../lib/upload';
import { Collection } from '../../components/ui/collection';
import { Modal } from '../../components/ui/modal';
import { Form } from '../../components/ui/forms';
import { FilePicker } from '../../components/ui/file-picker';
import { Button } from '../../components/ui/button';
export function ResourcesPage(){
  const {courseId}=useCourse(),{profile}=useSession(),cache=useQueryClient();const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[progress,setProgress]=useState<number>(),[error,setError]=useState('');
  async function download(id:string){try{const {url}=await api<{url:string}>(`/resources/${id}/download`);window.open(url,'_blank','noopener,noreferrer');}catch(e){setError((e as Error).message);}}
  return <><div className="page-heading"><div><p className="eyebrow">THE COURSE LIBRARY</p><h1>Resources, within reach.</h1><p>Everything you need for your next step.</p></div>{profile?.role!=='student'&&<Button disabled={!courseId} onClick={()=>setOpen(true)}><Plus size={16}/> Upload resource</Button>}</div>
    {error&&<p role="alert" className="error-banner">{error}</p>}<Collection<Resource> path={courseId?`/courses/${courseId}/resources`:null}>{(rows)=><div className="stack">{rows.map((r)=><article className="resource-row content-card" key={r.id}><span className="file-icon"><FileText/></span><div><h3>{r.title}</h3><p>{r.description}</p><small>{r.fileName} · {(r.sizeBytes/1024/1024).toFixed(2)} MB · {new Date(r.createdAt).toLocaleDateString()}</small></div><div className="row-actions"><Button variant="outline" onClick={()=>void download(r.id)}><Download size={15}/> Download</Button>{(profile?.role==='admin'||profile?.id===r.uploadedBy)&&<button className="icon-button" aria-label={`Delete ${r.title}`} onClick={async()=>{if(!window.confirm('Permanently delete this resource?'))return;try{await mutate(`/resources/${r.id}`,{},'DELETE');await cache.invalidateQueries();}catch(e){setError((e as Error).message);}}}><Trash2 size={17}/></button>}</div></article>)}</div>}</Collection>
    {open&&<Modal title="Upload course resource" onClose={()=>setOpen(false)}><Form fields={[{name:'title',label:'Resource title'},{name:'description',label:'Description',type:'textarea',required:false}]} submit="Upload resource" onSubmit={async(v)=>{if(!file)throw new Error('Choose a file');const data=new FormData();data.append('file',file);data.append('title',v.title!);data.append('description',v.description??'');await upload(`/courses/${courseId}/resources`,data,setProgress);setOpen(false);setFile(null);setProgress(undefined);await cache.invalidateQueries();}}><FilePicker file={file} onChange={setFile} progress={progress}/></Form></Modal>}
  </>;
}
