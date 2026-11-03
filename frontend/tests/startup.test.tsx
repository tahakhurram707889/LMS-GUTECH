import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AppProviders } from '../src/app/providers';
import { AppRouter } from '../src/app/router';
import { useSession } from '../src/features/auth/session';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

it('opens the real provider tree and login form with an expired or absent session', async () => {
  window.history.replaceState({}, '', '/login');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<AppProviders><AppRouter /></AppProviders>);
  expect(await screen.findByRole('button', { name: 'Sign in to workspace' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reload workspace' })).not.toBeInTheDocument();
  expect(fetcher).not.toHaveBeenCalled();
});

it('restores a valid session after a page reload using the refresh cookie', async () => {
  localStorage.setItem('gutech.session-present', '1');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{
    accessToken:'new-access-token',
    profile:{id:'user-1',username:'teacher1',fullName:'Test Teacher',email:'teacher@example.test',role:'teacher',mustChangePassword:false,createdAt:'2026-01-01T00:00:00Z'},
  }}), {status:200})));
  function SessionProbe() {
    const {profile,loading}=useSession();
    return <p>{loading?'Restoring':profile?.role??'Signed out'}</p>;
  }
  render(<AppProviders><SessionProbe/></AppProviders>);
  expect(await screen.findByText('teacher')).toBeInTheDocument();
});

it('clears an expired persisted session after one rejected refresh', async () => {
  window.history.replaceState({}, '', '/login');
  localStorage.setItem('gutech.session-present', '1');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'UNAUTHORIZED',message:'Please sign in'}}), {status:401}));
  vi.stubGlobal('fetch', fetcher);
  render(<AppProviders><AppRouter/></AppProviders>);
  expect(await screen.findByRole('button', {name:'Sign in to workspace'})).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('gutech.session-present')).toBeNull();
});
