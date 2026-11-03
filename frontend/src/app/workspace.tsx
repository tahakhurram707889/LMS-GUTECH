import { useEffect, useState,useRef } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { BookOpen, LayoutDashboard, FileText, ClipboardList, Bell, BarChart3, MessageCircle, CircleHelp, Users, GraduationCap, Menu, X, LogOut, UserRound, ChevronDown, ShieldCheck } from 'lucide-react';
import { useSession } from '../features/auth/session';
import { api,apiPage,mutate,getAccessToken } from '../lib/api';
import type { Course } from '../lib/contracts';
import { CourseContext } from '../features/courses/context';
import { realtimeClient } from '../lib/realtime';
export function Workspace(){
  const {profile,loading,logout}=useSession();const [mobile,setMobile]=useState(false),[courseId,setCourseId]=useState('');const cache=useQueryClient();
  const navigation=useRef<HTMLElement>(null),main=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null),wasOpen=useRef(false);
  useEffect(()=>{
    const screen=window.matchMedia('(max-width: 900px)');
    const update=()=>{
      if(navigation.current)navigation.current.inert=screen.matches&&!mobile;
      if(main.current)main.current.inert=screen.matches&&mobile;
      if(screen.matches&&mobile)navigation.current?.querySelector('button')?.focus();
      else if(wasOpen.current)toggle.current?.focus();
      wasOpen.current=mobile;
    };
    update();screen.addEventListener('change',update);return()=>screen.removeEventListener('change',update);
  },[mobile,profile?.id,loading]);
  const courses=useQuery({queryKey:['workspace-courses'],queryFn:({signal})=>apiPage<Course>('/me/courses?pageSize=100',signal),enabled:!!profile&&!profile.mustChangePassword});
  const notices=useQuery({queryKey:['workspace-notices'],queryFn:()=>apiPage<{id:string;title:string;body:string;readAt:string|null}>('/notifications?pageSize=20'),enabled:!!profile&&!profile.mustChangePassword,refetchInterval:30_000});
  const [noticeOpen,setNoticeOpen]=useState(false);
  const unread=useQuery({queryKey:['unread-announcements'],queryFn:()=>api<{announcements:number;notifications:number}>('/notifications/counts'),enabled:!!profile&&!profile.mustChangePassword,refetchInterval:30_000});
  useEffect(()=>{if(!courseId&&courses.data?.data[0])setCourseId(courses.data.data[0].id);},[courses.data,courseId]);
  useEffect(()=>{
    if(!profile)return;const client=realtimeClient();if(!client)return;
    void client.realtime.setAuth(getAccessToken());
    const updateAuth=()=>{void client.realtime.setAuth(getAccessToken());};window.addEventListener('sessiontoken',updateAuth);
    const channel=client.channel(`workspace-${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'announcements'},()=>void cache.invalidateQueries({predicate:(q)=>String(q.queryKey[0]).includes('announcement')}))
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${profile.id}`},()=>void cache.invalidateQueries({queryKey:['workspace-notices']})).subscribe();
    return()=>{window.removeEventListener('sessiontoken',updateAuth);void client.removeChannel(channel);};
  },[profile,cache]);
  if(loading)return <main className="fallback" role="status">Opening your workspace…</main>;
  if(!profile)return <Navigate to="/login" replace/>;
  if(profile.mustChangePassword)return <Navigate to="/change-password" replace/>;
  const links=[{to:`/${profile.role}/dashboard`,label:'Overview',icon:LayoutDashboard},{to:'/courses',label:profile.role==='teacher'?'My classes':'My courses',icon:BookOpen},...(profile.role==='teacher'?[{to:'/students',label:'Enrolled students',icon:Users}]:[]),{to:'/resources',label:'Resources',icon:FileText},{to:'/assignments',label:'Assignments',icon:ClipboardList},{to:'/quizzes',label:'Quizzes',icon:GraduationCap},{to:'/announcements',label:'Announcements',icon:Bell},{to:'/marks',label:profile.role==='student'?'My marks':'Gradebook',icon:BarChart3},{to:'/chat',label:'Classroom chat',icon:MessageCircle},{to:'/complaints',label:profile.role==='admin'?'Complaint queue':'Complaints',icon:CircleHelp},...(profile.role==='admin'?[{to:'/admin/users',label:'User management',icon:Users},{to:'/admin/courses',label:'Course management',icon:BookOpen},{to:'/admin/departments',label:'Departments',icon:GraduationCap}]:[])];
  return <CourseContext.Provider value={{courseId,select:setCourseId,courses:courses.data?.data??[]}}><div className="lms-shell">
    <a className="skip-link" href="#workspace-main">Skip to content</a>{mobile&&<button className="nav-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    <aside ref={navigation} id="workspace-navigation" className={`lms-sidebar ${mobile?'nav-open':''}`} onKeyDown={(e)=>{if(e.key==='Escape')setMobile(false);}}><div className="lms-brand"><GraduationCap/> gutech<span>.</span><button className="icon-button mobile-only" onClick={()=>setMobile(false)} aria-label="Close navigation"><X/></button></div>
      <div className="workspace-label"><ShieldCheck size={16}/><div>Internal workspace<small>{profile.role} account</small></div></div><p className="nav-section-label">YOUR WORKSPACE</p>
      <nav aria-label="Main navigation">{links.map((link)=><NavLink key={link.to} to={link.to} end onClick={()=>setMobile(false)}><link.icon size={18}/>{link.label}{link.to==='/announcements'&&!!unread.data?.announcements&&<span className="nav-badge">{unread.data.announcements}</span>}</NavLink>)}</nav>
      <div className="sidebar-end"><NavLink to="/profile"><div className="user-avatar">{profile.fullName.split(' ').map((n)=>n[0]).slice(0,2).join('')}</div><span>{profile.fullName}<small>View profile & settings</small></span></NavLink><button className="icon-button" aria-label="Sign out" onClick={()=>void logout()}><LogOut size={18}/></button></div>
    </aside><div ref={main} className="lms-main"><header className="workspace-topbar"><button ref={toggle} className="icon-button mobile-only" aria-label="Open navigation" aria-expanded={mobile} aria-controls="workspace-navigation" onClick={()=>setMobile(true)}><Menu/></button>
      <label className="course-picker"><BookOpen size={16}/><span className="sr-only">Current course</span><select value={courseId} onChange={(e)=>setCourseId(e.target.value)}><option value="">Choose a course</option>{courses.data?.data.map((c)=><option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select><ChevronDown size={14}/></label>
      {courses.error&&<span className="field-error">Could not load courses <button onClick={()=>void courses.refetch()}>Retry</button></span>}
      <div className="topbar-right"><div className="notices-wrap"><button className="icon-button" aria-label="Notifications" onClick={()=>{setNoticeOpen(!noticeOpen);}}><Bell size={19}/>{notices.data?.data.some((n)=>!n.readAt)&&<i className="unread-dot"/>}</button>
      {noticeOpen&&<div className="notice-popover"><strong>Notifications</strong>{notices.isLoading?<p role="status">Loading…</p>:notices.error?<p role="alert">Unable to load notifications</p>:notices.data?.data.length?notices.data.data.map((n)=><article key={n.id}><strong>{n.title}</strong><p>{n.body}</p></article>):<p>You’re all caught up.</p>}<button onClick={async()=>{await mutate('/notifications/read');await cache.invalidateQueries({queryKey:['workspace-notices']});}}>Mark all read</button></div>}</div><NavLink className="icon-button" to="/profile" aria-label="My profile"><UserRound size={19}/></NavLink></div>
    </header><main id="workspace-main" className="workspace-content"><Outlet/></main><footer className="workspace-footer"><span>GUTECH · Learning with purpose</span><span>Internal learning workspace</span></footer></div>
  </div></CourseContext.Provider>;
}
