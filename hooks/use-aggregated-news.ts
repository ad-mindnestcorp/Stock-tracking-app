import { useQuery, useQueryClient } from '@tanstack/react-query';
import { newsApi, NewsFilter } from '@/lib/api';

export const NEWS_QUERY_KEY = (filter?: NewsFilter, tickers?: string) =>
  ['aggregatedNews', filter ?? 'markets', tickers ?? ''] as const;

export function useAggregatedNews(filter?: NewsFilter, tickers?: string) {
  return useQuery({
    queryKey: NEWS_QUERY_KEY(filter, tickers),
    queryFn: () => newsApi.getFeed({ filter, tickers }),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useInvalidateNews() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['aggregatedNews'] });
}
