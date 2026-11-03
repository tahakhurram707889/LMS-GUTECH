import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Plus,ArrowUp,ArrowDown,Trash2,Clock3 } from 'lucide-react';
import { useCourse } from '../courses/context';
import { useSession } from '../auth/session';
import type { Quiz,Question,Attempt } from '../../lib/contracts';
import { api,mutate } from '../../lib/api';
import { Collection } from '../../components/ui/collection';
import { Modal } from '../../components/ui/modal';
import { Form,type Field } from '../../components/ui/forms';
import { Button } from '../../components/ui/button';
import { AsyncState } from '../../components/ui/async-state';
type Draft=Omit<Question,'id'>;
const fresh=():Draft=>({position:0,type:'mcq_single',prompt:'',options:[{id:'a',text:''},{id:'b',text:''}],correctOptionIds:['a'],marks:1});
const localDate=(value:string)=>new Date(new Date(value).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
function QuizBuilder({quiz,onDone}:{quiz?:Quiz;onDone:()=>void}){
  const {courseId}=useCourse();const [questions,setQuestions]=useState<Draft[]>(quiz?.questions??[fresh()]),[preview,setPreview]=useState(false);
  const change=(index:number,patch:Partial<Draft>)=>setQuestions((all)=>all.map((q,i)=>i===index?{...q,...patch}:q));
  const fields:Field[]=[{name:'title',label:'Quiz title'},{name:'description',label:'Description',type:'textarea',required:false},{name:'timeLimitMinutes',label:'Time limit (minutes)',type:'number'},{name:'opensAt',label:'Opens at',type:'datetime-local'},{name:'closesAt',label:'Closes at',type:'datetime-local'},{name:'isPublished',label:'Visibility',type:'select',options:[{value:'false',label:'Draft'},{value:'true',label:'Published'}]}];
  return <Form fields={fields} initial={quiz?{title:quiz.title,description:quiz.description,timeLimitMinutes:String(quiz.timeLimitMinutes),opensAt:localDate(quiz.opensAt),closesAt:localDate(quiz.closesAt),isPublished:String(quiz.isPublished)}:{timeLimitMinutes:'10',isPublished:'false'}} submit={quiz?'Save quiz':'Create quiz'} onSubmit={async(v)=>{
    await mutate(quiz?`/quizzes/${quiz.id}`:`/courses/${courseId}/quizzes`,{...v,timeLimitMinutes:Number(v.timeLimitMinutes),opensAt:new Date(v.opensAt!).toISOString(),closesAt:new Date(v.closesAt!).toISOString(),isPublished:v.isPublished==='true',questions:questions.map((q,position)=>({position,type:q.type,prompt:q.prompt,options:q.options,correctOptionIds:q.correctOptionIds,marks:q.marks}))},quiz?'PATCH':'POST');onDone();
  }}>
    <div className="section-heading"><h3>Questions</h3><Button variant="ghost" onClick={()=>setPreview(!preview)}>{preview?'Edit questions':'Preview'}</Button></div>
    {questions.map((q,index)=><section className="question-editor" key={index}><div className="card-title-row"><strong>Question {index+1}</strong><div className="row-actions"><button type="button" className="icon-button" aria-label="Move question up" disabled={index===0} onClick={()=>setQuestions((all)=>{const next=[...all];[next[index-1],next[index]]=[next[index]!,next[index-1]!];return next;})}><ArrowUp size={15}/></button><button type="button" className="icon-button" aria-label="Move question down" disabled={index===questions.length-1} onClick={()=>setQuestions((all)=>{const next=[...all];[next[index],next[index+1]]=[next[index+1]!,next[index]!];return next;})}><ArrowDown size={15}/></button><button type="button" className="icon-button" aria-label="Remove question" disabled={questions.length===1} onClick={()=>setQuestions(questions.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></div></div>
      {preview?<><h4>{q.prompt||'Untitled question'}</h4>{q.options.map((o)=><p key={o.id}>○ {o.text}</p>)}</>:<><label>Question type<select value={q.type} onChange={(e)=>{const type=e.target.value as Draft['type'];change(index,{type,...(type==='true_false'?{options:[{id:'true',text:'True'},{id:'false',text:'False'}],correctOptionIds:['true']}:{correctOptionIds:[q.options[0]!.id]})});}}><option value="mcq_single">Single choice</option><option value="mcq_multi">Multiple choice</option><option value="true_false">True / false</option></select></label><label>Question prompt<textarea value={q.prompt} onChange={(e)=>change(index,{prompt:e.target.value})} required/></label><label>Marks<input type="number" min="0.01" step="0.01" value={q.marks} onChange={(e)=>change(index,{marks:Number(e.target.value)})}/></label>
      <small>Select the correct option(s). These are visible only to staff.</small>{q.options.map((o,i)=><div className="option-editor" key={o.id}><input type={q.type==='mcq_multi'?'checkbox':'radio'} name={`correct-${index}`} aria-label={`Option ${i+1} is correct`} checked={q.correctOptionIds?.includes(o.id)??false} onChange={(e)=>change(index,{correctOptionIds:q.type==='mcq_multi'?(e.target.checked?[...(q.correctOptionIds??[]),o.id]:(q.correctOptionIds??[]).filter((id)=>id!==o.id)):[o.id]})}/><input aria-label={`Question ${index+1} option ${i+1}`} value={o.text} required onChange={(e)=>change(index,{options:q.options.map((item,j)=>j===i?{...item,text:e.target.value}:item)})}/>{q.type!=='true_false'&&q.options.length>2&&<button type="button" className="icon-button" aria-label="Remove option" onClick={()=>change(index,{options:q.options.filter((item)=>item.id!==o.id),correctOptionIds:q.correctOptionIds?.filter((id)=>id!==o.id)})}><Trash2 size={14}/></button>}</div>)}{q.type!=='true_false'&&q.options.length<12&&<Button variant="ghost" onClick={()=>change(index,{options:[...q.options,{id:crypto.randomUUID().slice(0,8),text:''}]})}>Add option</Button>}</>}
    </section>)}<Button variant="outline" disabled={questions.length>=100} onClick={()=>setQuestions([...questions,fresh()])}><Plus size={15}/> Add question</Button>
  </Form>;
}
function QuizRunner({quiz,onDone}:{quiz:Quiz;onDone:()=>void}){
  const [attempt,setAttempt]=useState<Attempt|null>(null),[answers,setAnswers]=useState<Record<string,string[]>>({}),[index,setIndex]=useState(0),[seconds,setSeconds]=useState(0),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false),[result,setResult]=useState<number|null>(null);
  const answersRef=useRef(answers);answersRef.current=answers;const sent=useRef(false),autoTriggered=useRef(false);
  const query=useQuery({queryKey:['attempt',quiz.id],queryFn:()=>api<Attempt>(`/quizzes/${quiz.id}/attempt`),retry:false});
  useEffect(()=>{if(query.data){setAttempt(query.data);setAnswers(query.data.answers??{});if(query.data.submittedAt)setResult(query.data.score);}},[query.data]);
  async function submit(auto=false){
    if(sent.current||(!auto&&!window.confirm('Submit your quiz? You cannot change answers afterward.')))return;
    sent.current=true;setSubmitting(true);setError('');
    try{const response=await mutate<{score:number}>(`/quizzes/${quiz.id}/attempt/submit`,{answers:answersRef.current});setResult(response.score);}catch(e){sent.current=false;setError((e as Error).message);}finally{setSubmitting(false);}
  }
  const submitRef=useRef(submit);submitRef.current=submit;
  useEffect(()=>{if(!attempt||result!==null)return;const tick=()=>{const remaining=Math.max(0,Math.ceil((new Date(attempt.expiresAt).getTime()-Date.now())/1000));setSeconds(remaining);if(remaining===0&&!autoTriggered.current){autoTriggered.current=true;void submitRef.current(true);}};tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[attempt,result]);
  if(result!==null)return <div className="quiz-result"><p className="eyebrow">QUIZ COMPLETE</p><h2>Your score: {result}</h2><p>Your score is now available in My marks.</p><Button onClick={onDone}>Return to quizzes</Button></div>;
  if(!attempt)return <AsyncState loading={query.isLoading} error={query.error} onRetry={()=>void query.refetch()}><p>Loading your attempt…</p></AsyncState>;
  const question=attempt.questions[index];if(!question)return <p>No questions available.</p>;
  return <><div className="quiz-timer" role="timer"><Clock3 size={18}/>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} remaining</div>{error&&<p role="alert" className="error-banner">{error}</p>}<div className="question-nav">{attempt.questions.map((q,i)=><button key={q.id} aria-label={`Question ${i+1}`} className={i===index?'selected':''} onClick={()=>setIndex(i)}>{i+1}{answers[q.id]?.length?' •':''}</button>)}</div>
    <p className="eyebrow">QUESTION {index+1} OF {attempt.questions.length} · {question.marks} MARKS</p><h3>{question.prompt}</h3><fieldset className="quiz-options"><legend className="sr-only">Choose your answer</legend>{question.options.map((o)=><label key={o.id}><input type={question.type==='mcq_multi'?'checkbox':'radio'} name={question.id} checked={answers[question.id]?.includes(o.id)??false} disabled={submitting||seconds===0} onChange={(e)=>setAnswers({...answers,[question.id]:question.type==='mcq_multi'?(e.target.checked?[...(answers[question.id]??[]),o.id]:(answers[question.id]??[]).filter((id)=>id!==o.id)):[o.id]})}/>{o.text}</label>)}</fieldset><Button disabled={submitting} onClick={()=>void submit()}>{submitting?'Submitting…':'Submit quiz'}</Button><p className="muted">The server enforces the deadline. Keep this window open until your score appears.</p>
  </>;
}
export function QuizzesPage(){
  const {courseId}=useCourse(),{profile}=useSession(),cache=useQueryClient();const [mode,setMode]=useState<'build'|'run'|'results'|null>(null),[quiz,setQuiz]=useState<Quiz>(),[error,setError]=useState('');const staff=profile?.role!=='student';
  const [params,setParams]=useSearchParams();const resultId=params.get('results');const target=useQuery({queryKey:['quiz-result-target',resultId],queryFn:()=>api<Quiz>(`/quizzes/${resultId}`),enabled:!!resultId&&staff});
  useEffect(()=>{if(target.data){setQuiz(target.data);setMode('results');}},[target.data]);
  const done=()=>{setMode(null);setParams({});void cache.invalidateQueries();};
  return <><div className="page-heading"><div><p className="eyebrow">CHECK YOUR UNDERSTANDING</p><h1>A little challenge. A lot of growth.</h1><p>Timed quizzes, clear results, new confidence.</p></div>{staff&&<Button disabled={!courseId} onClick={()=>{setQuiz(undefined);setMode('build');}}><Plus size={16}/> Build quiz</Button>}</div>{error&&<p role="alert" className="error-banner">{error}</p>}
    <Collection<Quiz> path={courseId?`/courses/${courseId}/quizzes`:null}>{(rows)=><div className="course-grid">{rows.map((q)=><article className="content-card" key={q.id}><span className="status-chip">{q.attempt?.submittedAt?'Completed':q.isPublished?'Published':'Draft'}</span><h2>{q.title}</h2><p>{q.description}</p><p className="muted">{q.timeLimitMinutes} minutes · One attempt</p><small>{new Date(q.opensAt).toLocaleString()} — {new Date(q.closesAt).toLocaleString()}</small><div className="row-actions"><Button onClick={async()=>{setError('');try{
      if(staff){setQuiz(await api<Quiz>(`/quizzes/${q.id}`));setMode('build');}else{if(!q.attempt){if(!confirm('Start your only attempt? The timer begins immediately.'))return;await mutate(`/quizzes/${q.id}/attempt`);await cache.invalidateQueries();}setQuiz(q);setMode('run');}
    }catch(e){setError((e as Error).message);}}}>{staff?'Edit / publish':q.attempt?.submittedAt?'View score':q.attempt?'Resume attempt':'Start quiz'}</Button>{staff&&<Button variant="outline" onClick={()=>{setQuiz(q);setMode('results');}}>Results</Button>}</div></article>)}</div>}</Collection>
    {mode&&<Modal title={mode==='build'?'Quiz builder':mode==='results'?'Quiz results':quiz?.title??'Quiz'} onClose={done}>{mode==='build'?<QuizBuilder quiz={quiz} onDone={done}/>:mode==='run'&&quiz?<QuizRunner quiz={quiz} onDone={done}/>:quiz?<Collection<{id:string;studentId:string;studentName:string;score:number|null;submittedAt:string|null}> path={`/quizzes/${quiz.id}/results`}>{(rows)=><div className="table-scroll"><table><thead><tr><th>Student</th><th>Score</th><th>Status</th></tr></thead><tbody>{rows.map((r)=><tr key={r.id}><td>{r.studentName}</td><td>{r.score??'Pending'}</td><td>{r.submittedAt?'Submitted':'In progress'}</td></tr>)}</tbody></table></div>}</Collection>:null}</Modal>}
  </>;
}
