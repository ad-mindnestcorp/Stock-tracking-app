import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { watchlistApi } from '@/lib/api';
import { toast } from '@/lib/toast';

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: watchlistApi.getAll,
  });
}

export function useAddStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ symbol, company_name }: { symbol: string; company_name?: string }) =>
      watchlistApi.add(symbol, company_name),
    onSuccess: (_, { symbol }) => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success(`${symbol} added to your watchlist`, 'Added');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'Failed to add');
    },
  });
}

export function useRemoveStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => watchlistApi.remove(symbol),
    onSuccess: (_, symbol) => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success(`${symbol} removed from watchlist`, 'Removed');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'Failed to remove');
    },
  });
}
