import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { mutate, refreshSession, setAccessToken } from '../../lib/api';
export type Profile={id:string;username:string;fullName:string;email:string;role:'admin'|'teacher'|'student';rollNo?:string;mustChangePassword:boolean;createdAt:string};
type Session={profile:Profile|null;loading:boolean;login:(username:string,password:string)=>Promise<void>;logout:()=>Promise<void>;reload:()=>Promise<void>};
const Context=createContext<Session|null>(null);
export function SessionProvider({children}:{children:ReactNode}){
  const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true);const cache=useQueryClient();
  useEffect(()=>{
    let alive=true;
    refreshSession().then((data)=>{if(alive&&data)setProfile(data.profile as Profile);}).catch(()=>{}).finally(()=>{if(alive)setLoading(false);});
    const expired=()=>{setProfile(null);cache.clear();};window.addEventListener('sessionexpired',expired);
    return()=>{alive=false;window.removeEventListener('sessionexpired',expired);};
  },[cache]);
  async function login(username:string,password:string){const data=await mutate<{accessToken:string;profile:Profile}>('/auth/login',{username,password});setAccessToken(data.accessToken);cache.clear();setProfile(data.profile);}
  async function logout(){try{await mutate('/auth/logout');}finally{setAccessToken();setProfile(null);cache.clear();}}
  async function reload(){const data=await refreshSession();if(data)setProfile(data.profile as Profile);}
  return <Context.Provider value={{profile,loading,login,logout,reload}}>{children}</Context.Provider>;
}
export function useSession(){const session=useContext(Context);if(!session)throw new Error('Missing SessionProvider');return session;}
