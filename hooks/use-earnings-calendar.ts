import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEarningsCalendar } from '@/lib/finnhub-direct';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Earnings calendar for a calendar month.
 * Pass any date that falls inside the month you want to load.
 */
export function useEarningsCalendar(monthAnchor: Date = new Date()) {
  const { from, to, monthKey } = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      from: formatYMD(start),
      to: formatYMD(end),
      monthKey: `${year}-${pad(month + 1)}`,
    };
  }, [monthAnchor]);

  return useQuery({
    queryKey: ['market', 'earnings-calendar', monthKey],
    queryFn: () => fetchEarningsCalendar(from, to),
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });
}
