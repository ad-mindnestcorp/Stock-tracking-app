import { useQuery } from '@tanstack/react-query';
import { marketApi, type EconomicCalendarItem } from '@/lib/api';

export type { EconomicCalendarItem };

export function useEconomicCalendar() {
  return useQuery({
    queryKey: ['market', 'economic-calendar'],
    queryFn: marketApi.getEconomicCalendar,
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });
}
