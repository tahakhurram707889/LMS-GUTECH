import { Link } from 'react-router-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { UserRound,ShieldCheck } from 'lucide-react';
import { useSession } from '../auth/session';
import { api,mutate } from '../../lib/api';
import type { Metrics } from '../../lib/contracts';
import { Form } from '../../components/ui/forms';
import { AsyncState } from '../../components/ui/async-state';
export function ProfilePage(){
  const {profile,reload,logout}=useSession(),cache=useQueryClient();const metrics=useQuery({queryKey:['metrics'],queryFn:()=>api<Metrics>('/me/metrics')});
  if(!profile)return null;
  return <><div className="page-heading"><div><p className="eyebrow">YOUR SPACE</p><h1>A little more about you.</h1><p>Manage your profile, account security, and learning progress.</p></div></div><div className="profile-layout"><aside className="content-card profile-identity"><div className="profile-large-avatar"><UserRound size={40}/></div><h2>{profile.fullName}</h2><span className="role-badge">{profile.role}</span><dl><dt>Username</dt><dd>{profile.username}</dd><dt>Email</dt><dd>{profile.email}</dd>{profile.rollNo&&<><dt>Roll number</dt><dd>{profile.rollNo}</dd></>}<dt>Member since</dt><dd>{new Date(profile.createdAt).toLocaleDateString()}</dd></dl></aside>
    <div className="stack"><section className="content-card"><h2>Profile information</h2><p>Your institution manages your email, role, and enrollment details.</p><Form fields={[{name:'fullName',label:'Full name'}]} initial={{fullName:profile.fullName}} onSubmit={async(v)=>{await mutate('/me/profile',v,'PATCH');await reload();await cache.invalidateQueries();}}/></section><section className="content-card"><h2><ShieldCheck size={18}/> Account security</h2><p>Keep your account protected with a unique password.</p><div className="row-actions"><Link className="button-link" to="/change-password">Change password</Link><button className="button-link secondary" onClick={()=>void logout()}>Sign out</button></div></section></div>
  </div><div className="section-heading"><h2>Your learning progress</h2></div><AsyncState loading={metrics.isLoading} error={metrics.error} onRetry={()=>void metrics.refetch()}><div className="metric-grid">{metrics.data&&[['Courses',metrics.data.courses],['Submissions',metrics.data.submissions],['Quizzes completed',metrics.data.quizzesCompleted],['Graded percentage',`${metrics.data.marks.percentage}%`]].map(([name,value])=><article className="metric-card" key={name}><small>{name}</small><strong>{value}</strong></article>)}</div></AsyncState></>;
}
