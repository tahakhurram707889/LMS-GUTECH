import { useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCourse } from '../courses/context';
import { useSession } from '../auth/session';
import { api,apiPage,downloadCsv } from '../../lib/api';
import type { Mark } from '../../lib/contracts';
import { AsyncState } from '../../components/ui/async-state';
import { Button } from '../../components/ui/button';
type Book={items:{id:string;title:string;kind:string;maximum:number}[];students:{id:string;name:string;rollNo:string;marks:Mark[];obtained:number;maximum:number}[];total:number};
export function MarksPage(){
  const {courseId}=useCourse(),{profile}=useSession(),navigate=useNavigate();const [page,setPage]=useState(1),[error,setError]=useState('');const student=profile?.role==='student';
  useEffect(()=>setPage(1),[courseId]);
  const marks=useQuery({queryKey:['marks',courseId,page],queryFn:()=>apiPage<Mark>(`/me/marks?courseId=${courseId}&page=${page}&pageSize=20`),enabled:student&&!!courseId});
  const book=useQuery({queryKey:['gradebook',courseId,page],queryFn:()=>api<Book>(`/courses/${courseId}/gradebook?page=${page}&pageSize=20`),enabled:!student&&!!courseId});
  const active=student?marks:book,total=student?marks.data?.meta.total??0:book.data?.total??0;
  return <><div className="page-heading"><div><p className="eyebrow">PROGRESS YOU CAN SEE</p><h1>{student?'Every effort adds up.':'Your course gradebook.'}</h1><p>Saved grades for assignments and quizzes. Pending work is excluded from totals.</p></div>{!student&&<Button disabled={!courseId} onClick={async()=>{try{await downloadCsv(`/courses/${courseId}/gradebook.csv`);}catch(e){setError((e as Error).message);}}}>Export CSV</Button>}</div>
    {error&&<p role="alert" className="error-banner">{error}</p>}{!courseId?<div className="empty-state">Choose a course to view marks.</div>:<AsyncState loading={active.isLoading} error={active.error} onRetry={()=>void active.refetch()} empty={student?marks.data?.data.length===0:book.data?.students.length===0}>
      {student&&marks.data?<><div className="marks-summary"><strong>{marks.data.summary?.percentage??0}%</strong><span>{marks.data.summary?.obtained??0} / {marks.data.summary?.maximum??0} graded marks</span><progress max="100" value={marks.data.summary?.percentage??0} aria-label="Graded percentage"/></div><div className="table-scroll"><table><thead><tr><th>Coursework</th><th>Type</th><th>Marks</th><th>Graded</th></tr></thead><tbody>{marks.data.data.map((m)=><tr key={`${m.kind}-${m.itemId}`}><td>{m.title}</td><td>{m.kind}</td><td>{m.obtained===null?'Pending':`${m.obtained} / ${m.max}`}</td><td>{m.gradedAt?new Date(m.gradedAt).toLocaleDateString():'—'}</td></tr>)}</tbody></table></div></>:book.data?<div className="table-scroll"><table className="gradebook-table"><thead><tr><th>Student</th>{book.data.items.map((i)=><th key={i.id}>{i.title}<small>{i.maximum} marks</small></th>)}<th>Total</th><th>%</th></tr></thead><tbody>{book.data.students.map((s)=><tr key={s.id}><th>{s.name}<small>{s.rollNo}</small></th>{book.data!.items.map((i)=>{const m=s.marks.find((m)=>m.itemId===i.id);return <td key={i.id}><button className="grade-cell" onClick={()=>navigate(i.kind==='assignment'?`/assignments?grade=${i.id}`:`/quizzes?results=${i.id}`)}>{m?.obtained??'Pending'}</button></td>;})}<td>{s.obtained} / {s.maximum}</td><td>{s.maximum?(s.obtained/s.maximum*100).toFixed(1):0}%</td></tr>)}</tbody></table></div>:null}
    </AsyncState>}<div className="pagination"><span>Page {page}</span><Button variant="ghost" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><Button variant="ghost" disabled={page*20>=total} onClick={()=>setPage(page+1)}>Next</Button></div>
  </>;
}
