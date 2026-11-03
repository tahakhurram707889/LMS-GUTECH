import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiPage } from '../../lib/api';
import { AsyncState } from './async-state';
import { Button } from './button';
export function Collection<T>({path,children}:{path:string|null;children:(rows:T[])=>ReactNode}){
  const [page,setPage]=useState(1);useEffect(()=>setPage(1),[path]);
  const query=useQuery({queryKey:[path,page],queryFn:({signal})=>apiPage<T>(`${path}${path?.includes('?')?'&':'?'}page=${page}&pageSize=20`,signal),enabled:!!path});
  if(!path)return <div className="empty-state">Choose a course above to open this space.</div>;
  return <><AsyncState loading={query.isLoading} error={query.error} empty={query.data?.data.length===0} onRetry={()=>void query.refetch()}>{query.data&&children(query.data.data)}</AsyncState>
    {query.data&&<div className="pagination"><span>{query.data.meta.total} items · Page {page}</span><Button variant="ghost" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</Button><Button variant="ghost" disabled={page*20>=query.data.meta.total} onClick={()=>setPage(page+1)}>Next</Button></div>}</>;
}
