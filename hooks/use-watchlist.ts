import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { watchlistApi, watchlistsApi } from '@/lib/api';
import { toast } from '@/lib/toast';

// ─── Legacy single-watchlist hooks (kept for backward compat) ────────────────

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

// ─── Multi-watchlist hooks ────────────────────────────────────────────────────

export function useWatchlists() {
  return useQuery({
    queryKey: ['watchlists'],
    queryFn: watchlistsApi.getAll,
  });
}

export function useWatchlistStocks(watchlistId: string) {
  return useQuery({
    queryKey: ['watchlists', watchlistId, 'stocks'],
    queryFn: () => watchlistsApi.getStocks(watchlistId),
    enabled: !!watchlistId,
  });
}

export function useCreateWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => watchlistsApi.create(name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      toast.success(`"${data.name}" created`, 'Watchlist created');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'Failed to create');
    },
  });
}

export function useRenameWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => watchlistsApi.rename(id, name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      toast.success(`Renamed to "${data.name}"`, 'Watchlist renamed');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'Failed to rename');
    },
  });
}

export function useDeleteWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => watchlistsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlists'] });
      toast.success('Watchlist deleted', 'Deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'Failed to delete');
    },
  });
}

export function useAddStockToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, symbol, company_name }: { watchlistId: string; symbol: string; company_name?: string }) =>
      watchlistsApi.addStock(watchlistId, symbol, company_name),
    onSuccess: (_, { watchlistId, symbol }) => {
      qc.invalidateQueries({ queryKey: ['watchlists', watchlistId, 'stocks'] });
      toast.success(`${symbol} added`, 'Added');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'Failed to add');
    },
  });
}

export function useRemoveStockFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) =>
      watchlistsApi.removeStock(watchlistId, symbol),
    onSuccess: (_, { watchlistId, symbol }) => {
      qc.invalidateQueries({ queryKey: ['watchlists', watchlistId, 'stocks'] });
      toast.success(`${symbol} removed`, 'Removed');
    },
    onError: (err: Error) => {
      toast.error(err.message, 'Failed to remove');
    },
  });
}
