import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { fetchFavorites } from '@/features/favorites/favorites-service';

export function useFavorites() {
  const { user, session, isSignedIn, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;

  return useQuery({
    queryKey: queryKeys.favorites(userId ?? 'none'),
    queryFn: () => fetchFavorites(token!, userId!),
    enabled: !authLoading && isSignedIn && !!userId && !!token,
    staleTime: 60_000,
  });
}
