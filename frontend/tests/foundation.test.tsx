import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from '../src/app/router';
import { AsyncState } from '../src/components/ui/async-state';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '../src/features/auth/session';
vi.mock('../src/lib/api', async (original) => ({...await original<typeof import('../src/lib/api')>(),refreshSession:vi.fn().mockRejectedValue(new Error('No session'))}));
function renderApp(path='/login') {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={[path]}><SessionProvider><AppRouter/></SessionProvider></MemoryRouter></QueryClientProvider>);
}

afterEach(cleanup);
describe('Frontend routing and shared states', () => {
  it('shows internal login without a public signup control', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: /your next chapter/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument();
  });
  it('returns a not-found screen for unsupported routes, including signup', () => {
    renderApp('/signup');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
  it('has accessible loading and error states', () => {
    const { rerender } = render(<AsyncState loading><span>Private content</span></AsyncState>);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
    rerender(<AsyncState loading={false} error={new Error('Please try again')} onRetry={() => {}}>
      <span>Private content</span></AsyncState>);
    expect(screen.getByRole('alert')).toHaveTextContent('Please try again');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
