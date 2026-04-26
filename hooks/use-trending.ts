import { useQuery } from '@tanstack/react-query';
import { trendingApi } from '@/lib/api';

export function useTrending() {
  return useQuery({
    queryKey: ['trending-reddit'],
    queryFn: trendingApi.getAll,
    staleTime: 5 * 60_000,
  });
}
