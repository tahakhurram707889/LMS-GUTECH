import { afterEach,describe,it,expect,vi } from 'vitest';
import { api,refreshSession,setAccessToken } from '../src/lib/api';
afterEach(()=>{setAccessToken();localStorage.clear();vi.unstubAllGlobals();});
describe('API transport',()=>{
  it('does not probe refresh when no session has been established',async()=>{
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    await expect(refreshSession()).resolves.toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('restores a marked session using the HttpOnly cookie and rotates the access token',async()=>{
    setAccessToken('previous-access-token');
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{accessToken:'restored-access-token',profile:{role:'teacher'}}}),{status:200}));
    vi.stubGlobal('fetch',fetcher);
    await expect(refreshSession()).resolves.toMatchObject({accessToken:'restored-access-token'});
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe('include');
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Content-Type')).toBe('application/json');
  });
  it('clears the session hint after the refresh cookie is rejected',async()=>{
    setAccessToken('old-access-token');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'Please sign in'}}),{status:401})));
    await expect(refreshSession()).rejects.toMatchObject({status:401});
    expect(localStorage.getItem('gutech.session-present')).toBeNull();
  });
  it('refreshes an expired access token and retries with the new token',async()=>{
    setAccessToken('old-token');
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{message:'Expired'}}),{status:401}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{accessToken:'new-token',profile:{}}}),{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{title:'My course'}}),{status:200}));
    vi.stubGlobal('fetch',fetcher);expect(await api('/me/courses')).toEqual({title:'My course'});
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe('Bearer new-token');
  });
  it('leaves multipart content boundaries to the browser',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{id:'resource'}}),{status:200}));vi.stubGlobal('fetch',fetcher);
    const form=new FormData();form.append('title','Notes');await api('/upload',{method:'POST',body:form});
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('Content-Type')).toBe(false);
  });
  it('provides an actionable connection error',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/me/courses')).rejects.toMatchObject({code:'NETWORK_ERROR'});
  });
});
