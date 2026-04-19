import { useQuery } from '@tanstack/react-query';
import { marketApi } from '@/lib/api';

export function useStockDetail(symbol: string) {
  return useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: () => marketApi.getDetail(symbol),
    enabled: !!symbol,
    staleTime: 30_000,
  });
}

export type CandleRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

export function useCandles(symbol: string, range: CandleRange) {
  return useQuery({
    queryKey: ['candles', symbol, range],
    queryFn: () => marketApi.getCandles(symbol, range),
    enabled: !!symbol,
    staleTime: 60_000,
  });
}
