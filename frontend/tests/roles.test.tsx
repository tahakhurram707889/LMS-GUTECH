import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppRouter} from '../src/app/router';
import {useSession,type Profile} from '../src/features/auth/session';
import {api,apiPage} from '../src/lib/api';
vi.mock('../src/features/auth/session',()=>({useSession:vi.fn()}));
vi.mock('../src/lib/api',()=>({api:vi.fn(),apiPage:vi.fn(),mutate:vi.fn(),getAccessToken:vi.fn()}));
vi.mock('../src/lib/realtime',()=>({realtimeClient:()=>undefined}));
function session(role:'admin'|'teacher'|'student'|null,mustChangePassword=false){
  vi.mocked(useSession).mockReturnValue({profile:role?{id:'test',username:'test.user',fullName:'Test Person',email:'test@example.test',role,mustChangePassword,createdAt:'2026-01-01'} as Profile:null,loading:false,login:vi.fn(),logout:vi.fn(),reload:vi.fn()});
}
function open(path:string){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})}><MemoryRouter initialEntries={[path]}><AppRouter/></MemoryRouter></QueryClientProvider>);}
beforeEach(()=>{
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  vi.mocked(apiPage).mockResolvedValue({data:[],meta:{page:1,pageSize:20,total:0}});
  vi.mocked(api).mockResolvedValue({role:'student',stats:{courses:2,students:12,teachers:3,enrollments:20,assignments:4,pendingGrading:2,submissions:1,quizzesCompleted:1,marks:{obtained:0,maximum:0,percentage:0}},upcoming:[],activity:[]});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('Protected role dashboards',()=>{
  it.each([['admin','Total students'],['teacher','Assigned courses'],['student','Your submissions']] as const)('redirects %s login to its own dashboard with real API metrics',async(role,label)=>{
    session(role);open('/login');expect(await screen.findByText(label)).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/me/dashboard');expect(await screen.findByText('No upcoming assignments.')).toBeInTheDocument();
  });
  it('shows 403 when a student opens an admin dashboard or management page',async()=>{
    session('student');const view=open('/admin/dashboard');expect(await screen.findByText(/403/)).toBeInTheDocument();
    view.unmount();open('/admin/users');expect(await screen.findByText(/403/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith('/me/dashboard');
  });
  it('redirects unauthenticated access to username login and supports password visibility',async()=>{
    session(null);open('/teacher/dashboard');expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    const password=screen.getByLabelText('LMS password');expect(password).toHaveAttribute('type','password');
    fireEvent.click(screen.getByRole('button',{name:'Show password'}));expect(password).toHaveAttribute('type','text');
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
  });
  it('requires first-password change before opening a dashboard',async()=>{
    session('teacher',true);open('/teacher/dashboard');expect(await screen.findByRole('heading',{name:'Update your password.'})).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith('/me/dashboard');
  });
});
