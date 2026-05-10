import { useQuery } from '@tanstack/react-query';
import { marketApi } from '@/lib/api';

export function useSectors() {
  return useQuery({
    queryKey: ['market', 'sectors'],
    queryFn: marketApi.getSectors,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
