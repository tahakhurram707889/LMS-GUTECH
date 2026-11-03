import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { Workspace } from './workspace';
import { LoginPage, ForgotPassword, PasswordPage } from '../features/auth/pages';
import { useSession } from '../features/auth/session';
import { CoursesPage } from '../features/courses/pages';
import { ResourcesPage } from '../features/resources/page';
import { AssignmentsPage } from '../features/assignments/page';
import { QuizzesPage } from '../features/quizzes/page';
import { AnnouncementsPage } from '../features/announcements/page';
import { MarksPage } from '../features/marks/page';
import { ChatPage } from '../features/chat/page';
import { ComplaintsPage } from '../features/complaints/page';
import { ProfilePage } from '../features/profile/page';
import { UsersPage, ManageCoursesPage } from '../features/admin/pages';
import { Dashboard } from '../features/dashboard/page';
import { DepartmentsPage } from '../features/admin/departments';
import { StudentsPage } from '../features/courses/students';
export function Forbidden(){return <section className="content-card" role="alert"><p className="eyebrow">403 - ACCESS DENIED</p><h1>You do not have access to this page.</h1><Link to="/">Return to your dashboard</Link></section>;}
function AdminOnly({children}:{children:React.ReactNode}){const {profile}=useSession();return profile?.role==='admin'?children:<Forbidden/>;}
function Home() {
  const {profile,loading}=useSession();
  if(loading)return <main className="fallback" role="status">Opening your workspace?</main>;
  return <Navigate to={profile?(profile.mustChangePassword?'/change-password':`/${profile.role}/dashboard`):'/login'} replace/>;
}
function RoleDashboard({role}:{role:string}) { const {profile}=useSession(); return profile?.role===role?<Dashboard/>:<Forbidden/>; }
export function AppRouter() {
  return <Routes>
    <Route path="/" element={<Home/>}/><Route path="/login" element={<LoginPage/>}/>
    <Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<PasswordPage recovery/>}/><Route path="/change-password" element={<PasswordPage/>}/>
    <Route element={<Workspace/>}>
      {['admin','teacher','student'].map((role)=><Route key={role} path={`/${role}`}><Route index element={<Navigate to={`/${role}/dashboard`} replace/>}/><Route path="dashboard" element={<RoleDashboard role={role}/>}/></Route>)}
      <Route path="/courses" element={<CoursesPage/>}/><Route path="/resources" element={<ResourcesPage/>}/><Route path="/assignments" element={<AssignmentsPage/>}/>
      <Route path="/quizzes" element={<QuizzesPage/>}/><Route path="/announcements" element={<AnnouncementsPage/>}/><Route path="/marks" element={<MarksPage/>}/>
      <Route path="/chat" element={<ChatPage/>}/><Route path="/complaints" element={<ComplaintsPage/>}/><Route path="/profile" element={<ProfilePage/>}/>
      <Route path="/admin/users" element={<AdminOnly><UsersPage/></AdminOnly>}/><Route path="/admin/courses" element={<AdminOnly><ManageCoursesPage/></AdminOnly>}/>
      <Route path="/admin/departments" element={<AdminOnly><DepartmentsPage/></AdminOnly>}/>
      <Route path="/students" element={<TeachingOnly/>}/>
    </Route>
    <Route path="*" element={<main className="fallback"><p className="eyebrow">404</p><h1>Page not found</h1><Link to="/">Return to workspace</Link></main>}/>
  </Routes>;
}
function TeachingOnly(){const {profile}=useSession();return profile?.role==='teacher'||profile?.role==='admin'?<StudentsPage/>:<Forbidden/>;}
