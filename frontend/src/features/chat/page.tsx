import { useEffect,useRef,useState } from 'react';
import { useInfiniteQuery,useQuery,useQueryClient } from '@tanstack/react-query';
import { Send,Trash2 } from 'lucide-react';
import { useCourse } from '../courses/context';
import { useSession } from '../auth/session';
import type { Member,Message } from '../../lib/contracts';
import { apiPage,mutate,getAccessToken } from '../../lib/api';
import { realtimeClient } from '../../lib/realtime';
import { AsyncState } from '../../components/ui/async-state';
import { Button } from '../../components/ui/button';
type Pending={id:string;body:string;failed:boolean};
export function ChatPage(){
  const {courseId,courses,select}=useCourse(),{profile}=useSession(),cache=useQueryClient();const [body,setBody]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState<Pending[]>([]),[live,setLive]=useState(false);const pane=useRef<HTMLDivElement>(null),atBottom=useRef(true);
  const history=useInfiniteQuery({queryKey:['messages',courseId],initialPageParam:undefined as string|undefined,queryFn:({pageParam,signal})=>apiPage<Message>(`/courses/${courseId}/messages?limit=50${pageParam?`&before=${encodeURIComponent(pageParam)}`:''}`,signal),getNextPageParam:(last)=>last.meta.nextCursor??undefined,enabled:!!courseId,refetchInterval:live?false:5000});
  const members=useQuery({queryKey:['members',courseId],queryFn:()=>apiPage<Member>(`/courses/${courseId}/members?pageSize=100`),enabled:!!courseId});
  const messages=[...new Map(history.data?.pages.flatMap((page)=>page.data).map((m)=>[m.id,m])??[]).values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  useEffect(()=>{setPending([]);setError('');setLive(false);atBottom.current=true;},[courseId]);
  useEffect(()=>{
    if(!courseId)return;const client=realtimeClient();if(!client)return;void client.realtime.setAuth(getAccessToken());
    const channel=client.channel(`chat-${courseId}`).on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:`course_id=eq.${courseId}`},()=>void cache.invalidateQueries({queryKey:['messages',courseId]})).subscribe((status)=>setLive(status==='SUBSCRIBED'));
    return()=>{void client.removeChannel(channel);};
  },[courseId,cache]);
  useEffect(()=>{if(atBottom.current&&pane.current)pane.current.scrollTop=pane.current.scrollHeight;},[messages.length,pending.length]);
  async function send(draft:Pending){
    setPending((list)=>list.some((p)=>p.id===draft.id)?list.map((p)=>p.id===draft.id?{...p,failed:false}:p):[...list,draft]);
    try{await mutate(`/courses/${courseId}/messages`,{body:draft.body});await cache.invalidateQueries({queryKey:['messages',courseId]});setPending((list)=>list.filter((p)=>p.id!==draft.id));}catch(e){setPending((list)=>list.map((p)=>p.id===draft.id?{...p,failed:true}:p));setError((e as Error).message);}
  }
  return <><div className="page-heading"><div><p className="eyebrow">LEARN TOGETHER</p><h1>Your classroom, connected.</h1><p>Ask a question. Share an idea. Keep the conversation going.</p></div><span className="status-chip">{live?'Live connection':'Connecting · history refresh active'}</span></div>
    <div className="chat-layout"><aside className="chat-courses" aria-label="Chat courses">{courses.map((c)=><button className={c.id===courseId?'selected':''} key={c.id} onClick={()=>select(c.id)}><span>{c.code}</span>{c.title}</button>)}</aside><section className="chat-room" aria-label="Classroom messages">
    {!courseId?<div className="empty-state">Choose your classroom.</div>:<><div className="chat-room-heading"><h2>{courses.find((c)=>c.id===courseId)?.title??'Classroom'}</h2><small>{live?'Messages update in real time':'Reconnecting to live updates'}</small></div>
      <div ref={pane} className="chat-message-pane" onScroll={()=>{if(pane.current)atBottom.current=pane.current.scrollHeight-pane.current.scrollTop-pane.current.clientHeight<90;}}>
        {history.hasNextPage&&<Button variant="ghost" disabled={history.isFetchingNextPage} onClick={async()=>{const before=pane.current?.scrollHeight??0;await history.fetchNextPage();requestAnimationFrame(()=>{if(pane.current)pane.current.scrollTop=pane.current.scrollHeight-before;});}}>Load older messages</Button>}
        <AsyncState loading={history.isLoading} error={history.error} empty={messages.length===0&&pending.length===0} onRetry={()=>void history.refetch()}>{messages.map((m)=>{const member=members.data?.data.find((p)=>p.id===m.senderId);return <article key={m.id} className={`chat-message ${m.senderId===profile?.id?'own-message':''}`}><div className="message-author"><strong>{m.senderName??member?.fullName??(m.senderId===profile?.id?profile.fullName:'Course member')}</strong><span>{m.senderRole??member?.role}</span><time>{new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>{!m.deletedAt&&(m.senderId===profile?.id||profile?.role!=='student')&&<button className="icon-button" aria-label="Delete message" onClick={async()=>{try{await mutate(`/messages/${m.id}`,{},'DELETE');await cache.invalidateQueries({queryKey:['messages',courseId]});}catch(e){setError((e as Error).message);}}}><Trash2 size={13}/></button>}</div><p>{m.deletedAt?'Message deleted':m.body}</p></article>;})}</AsyncState>
        {pending.map((p)=><article key={p.id} className="chat-message own-message pending-message"><p>{p.body}</p><small>{p.failed?'Failed to send':'Sending…'}</small>{p.failed&&<button onClick={()=>void send(p)}>Retry</button>}</article>)}
      </div>{error&&<p role="alert" className="error-banner">{error}</p>}
      {profile?.role==='admin'?<p className="muted chat-readonly">Administrator view · Read and moderate classroom conversations.</p>:<form className="chat-compose" onSubmit={(e)=>{e.preventDefault();const text=body.trim();if(!text)return;setBody('');atBottom.current=true;void send({id:crypto.randomUUID(),body:text,failed:false});}}><label className="sr-only" htmlFor="message-body">Message</label><textarea id="message-body" rows={2} maxLength={2000} value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Share something with your classroom…"/><Button type="submit" disabled={!body.trim()}><Send size={17}/><span>Send</span></Button></form>}
    </>}
    </section></div>
  </>;
}
