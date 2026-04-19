import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient instance.
 *
 * - staleTime 60s  → don't refetch if data is younger than 1 min
 * - retry 1        → retry failed requests once before surfacing an error
 * - refetchOnWindowFocus false → prevents unnecessary refetches on app focus in RN
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
