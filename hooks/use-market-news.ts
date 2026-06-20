import { useQuery } from '@tanstack/react-query';
import { marketApi, type MarketNewsItem } from '@/lib/api';

export type { MarketNewsItem };

export function useMarketNews(category = 'general') {
  return useQuery({
    queryKey: ['market', 'news', category],
    queryFn: () => marketApi.getNews(category),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
