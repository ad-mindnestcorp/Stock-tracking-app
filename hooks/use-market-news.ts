import { useQuery } from '@tanstack/react-query';
import { fetchMarketNews } from '@/lib/finnhub-direct';

export function useMarketNews(category = 'general') {
  return useQuery({
    queryKey: ['market', 'news', category],
    queryFn: () => fetchMarketNews(category),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
