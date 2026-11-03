import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/** Feature hooks provide stable query keys and typed API contracts. */
export function useApiQuery<T>(key: readonly string[], path: string, enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<T>(path, { signal }),
    enabled,
  });
}
