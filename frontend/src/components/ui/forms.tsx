import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './button';
export type Field={name:string;label:string;type?:'text'|'email'|'password'|'number'|'datetime-local'|'textarea'|'select';required?:boolean;options?:{value:string;label:string}[];hint?:string};
export function Form({fields,initial={},submit='Save changes',onSubmit,children}:{fields:Field[];initial?:Record<string,string>;submit?:string;onSubmit:(values:Record<string,string>)=>Promise<void>;children?:ReactNode}){
  const [error,setError]=useState('');
  const shape=Object.fromEntries(fields.map((f)=>[f.name,f.type==='email'?z.string().email():f.required===false?z.string().max(50_000):z.string().min(1,`${f.label} is required`).max(50_000)]));
  const {register,handleSubmit,watch,formState:{errors,isSubmitting}}=useForm<Record<string,string>>({resolver:zodResolver(z.object(shape)),defaultValues:initial});
  const candidate=watch('newPassword')??'';
  const strength=[candidate.length>=10,/[A-Za-z]/.test(candidate),/\d/.test(candidate),/[^A-Za-z0-9]/.test(candidate)].filter(Boolean).length;
  return <form className="lms-form" onSubmit={handleSubmit(async(values)=>{setError('');try{await onSubmit(values);}catch(e){setError(e instanceof Error?e.message:'Could not save');}})}>
    {error&&<div className="error-banner" role="alert">{error}</div>}
    {fields.map((f)=><label key={f.name}>{f.label}
      {f.type==='textarea'?<textarea rows={4} {...register(f.name)}/>:f.type==='select'?<select {...register(f.name)}>{f.options?.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input type={f.type??'text'} step={f.type==='number'?'any':undefined} {...register(f.name)} autoComplete={f.type==='password'?'new-password':undefined}/>}
      {f.hint&&<small>{f.hint}</small>}{errors[f.name]&&<small className="field-error">{String(errors[f.name]?.message)}</small>}
    </label>)}{fields.some((f)=>f.name==='newPassword')&&<label>Password strength<progress max={4} value={strength} aria-label="Password strength"/></label>}{children}<Button type="submit" disabled={isSubmitting}>{isSubmitting?'Saving…':submit}</Button>
  </form>;
}
