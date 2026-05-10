import { useQuery } from '@tanstack/react-query';
import { marketApi } from '@/lib/api';

export function useIndexes() {
  return useQuery({
    queryKey: ['market', 'indexes'],
    queryFn: marketApi.getIndexes,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
