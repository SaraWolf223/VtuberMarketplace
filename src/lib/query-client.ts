import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      // AppState "focus" flaps on Android emulator cause refetch storms and jank.
      refetchOnWindowFocus: false,
    },
  },
});
