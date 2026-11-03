import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession } from './session';
import { mutate } from '../../lib/api';
import { Form } from '../../components/ui/forms';
import { Button } from '../../components/ui/button';
const loginSchema=z.object({username:z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),password:z.string().min(1)});
function AuthLayout({children}:{children:React.ReactNode}){
  return <main className="auth-layout"><section className="auth-story"><Link className="lms-brand" to="/"><GraduationCap/> gutech<span>.</span></Link>
    <div><p className="eyebrow">YOUR LEARNING WORKSPACE</p><h1>Great minds.<br/>Endless <em>possibilities.</em></h1><p>A space for your courses, your community, and everything you’re becoming.</p></div><small><ShieldCheck size={15}/> Internal access · Made for your institution</small>
  </section><section className="auth-panel">{children}</section></main>;
}
export function LoginPage(){
  const session=useSession(),navigate=useNavigate();const [visible,setVisible]=useState(false),[error,setError]=useState('');
  const {register,handleSubmit,resetField,formState:{errors,isSubmitting}}=useForm<z.infer<typeof loginSchema>>({resolver:zodResolver(loginSchema),defaultValues:{username:'',password:''}});
  if(session.profile)return <Navigate to={session.profile.mustChangePassword?'/change-password':`/${session.profile.role}/dashboard`} replace/>;
  return <AuthLayout><div className="auth-content"><p className="eyebrow">WELCOME BACK</p><h2>Your next chapter starts here.</h2><p>Use the username and LMS password provided by your administrator.</p>
    <form className="lms-form" onSubmit={handleSubmit(async(v)=>{setError('');try{await session.login(v.username,v.password);navigate('/');}catch(e){setError(e instanceof Error?e.message:'Unable to sign in');}})}>
      {error&&<div className="error-banner" role="alert">{error}</div>}
      <label>Username<input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('username')}/>{errors.username&&<small className="field-error">Enter your assigned username</small>}</label>
      <label>LMS password<div className="password-input"><input aria-label="LMS password" type={visible?'text':'password'} aria-describedby="lms-password-help" autoComplete="section-gutech-lms current-password" {...register('password')}/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><small id="lms-password-help">Enter your internal LMS account password, not your email account password.</small></label>
      <button type="button" className="forgot-link" disabled={isSubmitting} onClick={()=>resetField('password',{defaultValue:''})}>Clear saved password</button>
      <Link to="/forgot-password" className="forgot-link">Forgot password?</Link><Button type="submit" disabled={isSubmitting}>{isSubmitting?'Signing in…':'Sign in to workspace'}</Button>
    </form><div className="auth-footnote"><ShieldCheck size={14}/> Secure, institution-managed accounts</div></div></AuthLayout>;
}
export function ForgotPassword(){const [done,setDone]=useState(false);return <AuthLayout><div className="auth-content"><p className="eyebrow">ACCOUNT RECOVERY</p><h2>Let’s get you back in.</h2>{done?<p role="status">If this account exists, a password reset link has been sent. Please check your inbox.</p>:<Form fields={[{name:'email',label:'Email address',type:'email'}]} submit="Send reset link" onSubmit={async(v)=>{await mutate('/auth/forgot-password',v);setDone(true);}}/>}<Link to="/login">Back to sign in</Link></div></AuthLayout>;}
export function PasswordPage({recovery=false}:{recovery?:boolean}){
  const [params]=useSearchParams();const session=useSession();const [done,setDone]=useState(false);const tokenHash=params.get('token_hash');
  if(!recovery&&!session.profile)return <Navigate to="/login" replace/>;
  return <AuthLayout><div className="auth-content"><p className="eyebrow">PROTECT YOUR ACCOUNT</p><h2>{recovery?'Choose a new password.':'Update your password.'}</h2>
    {done?<><p role="status">Your password has been updated. Sign in with your new password.</p><Link to="/login" onClick={()=>window.location.assign('/login')}>Sign in</Link></>:recovery&&!tokenHash?<><p role="alert">This recovery link is incomplete or expired.</p><Link to="/forgot-password">Request a new link</Link></>:<Form fields={[...(!recovery?[{name:'currentPassword',label:'Current password',type:'password' as const}]:[]),{name:'newPassword',label:'New password',type:'password',hint:'At least 10 characters, including a letter and a number.'},{name:'confirmPassword',label:'Confirm password',type:'password'}]} submit="Update password" onSubmit={async(v)=>{
      if(v.newPassword!==v.confirmPassword)throw new Error('Passwords do not match');
      if(!/^(?=.*[A-Za-z])(?=.*\d).{10,128}$/.test(v.newPassword??''))throw new Error('Use 10–128 characters with a letter and a number');
      await mutate(recovery?'/auth/reset-password':'/auth/change-password',recovery?{tokenHash,newPassword:v.newPassword}:{currentPassword:v.currentPassword,newPassword:v.newPassword});
      setDone(true);if(!recovery)await session.logout().catch(()=>{});
    }}/>}
    {recovery&&<Link to="/forgot-password">Request a new reset link</Link>}
  </div></AuthLayout>;
}
