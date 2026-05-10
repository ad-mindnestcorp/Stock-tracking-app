import { useQuery } from '@tanstack/react-query';
import { marketApi } from '@/lib/api';

export function useUnusualVolume() {
  return useQuery({
    queryKey: ['market', 'unusual-volume'],
    queryFn: marketApi.getUnusualVolume,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
