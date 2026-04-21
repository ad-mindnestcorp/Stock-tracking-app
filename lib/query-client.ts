import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Shared QueryClient instance.
 *
 * - staleTime 2 min  → serve cached data while revalidating in background
 * - gcTime 24 h      → keep data in memory so tab switches are instant
 * - retry 1          → retry once on failure, then surface the error
 * - refetchOnWindowFocus false → no unnecessary refetches on app focus in RN
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,   // 2 min — fresh enough for stock data
      gcTime: 24 * 60 * 60_000, // 24 h  — keep in memory across tab switches
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Persist the cache to AsyncStorage so data survives app restarts.
// Max cache age: 30 min — stale market data older than that is not useful.
const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'STOCKVEST_QUERY_CACHE',
  throttleTime: 1000,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 30 * 60_000, // 30 min
});
