import { useQuery } from '@tanstack/react-query';
import { fetchEconomicCalendar } from '@/lib/finnhub-direct';

export function useEconomicCalendar() {
  return useQuery({
    queryKey: ['market', 'economic-calendar'],
    queryFn: fetchEconomicCalendar,
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });
}
