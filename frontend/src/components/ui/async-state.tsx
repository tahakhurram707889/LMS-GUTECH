import type { ReactNode } from 'react';
import { Button } from './button';

export function AsyncState({ loading, error, empty, onRetry, children, skeleton }: {
  loading: boolean; error?: Error | null; empty?: boolean; onRetry?: () => void; children: ReactNode; skeleton?:ReactNode;
}) {
  if (loading && skeleton) return skeleton;
  if (loading) return <div role="status" aria-live="polite" className="state-panel">Loading your workspace…</div>;
  if (error) return <div role="alert" className="state-panel"><p>{error.message}</p>
    {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}</div>;
  if (empty) return <div className="state-panel"><h2>Nothing here yet</h2><p>New items will appear here.</p></div>;
  return children;
}
