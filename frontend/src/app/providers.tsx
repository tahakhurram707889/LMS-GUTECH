import { Component, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from '../features/auth/session';

const queryClient = new QueryClient({ defaultOptions: { queries: {
  retry: 1, staleTime: 30_000, refetchOnWindowFocus: false,
} } });

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fallback" role="alert">
      <h1>We couldn’t open your workspace.</h1><p>Please reload and try again.</p>
      <button onClick={() => window.location.reload()}>Reload workspace</button>
    </main>;
    return this.props.children;
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  return <ErrorBoundary><QueryClientProvider client={queryClient}>
    <BrowserRouter><SessionProvider>{children}</SessionProvider></BrowserRouter>
  </QueryClientProvider></ErrorBoundary>;
}
