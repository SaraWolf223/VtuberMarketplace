import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { fetchFavoriteIds } from '@/features/favorites/favorites-service';

export function useFavoriteIds() {
  const { user, session, isSignedIn, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const token = session?.access_token;

  const query = useQuery({
    queryKey: queryKeys.favoriteIds(userId ?? 'none'),
    queryFn: () => fetchFavoriteIds(token!, userId!),
    enabled: !authLoading && isSignedIn && !!userId && !!token,
    staleTime: 60_000,
  });

  const idSet = new Set(query.data ?? []);

  return {
    ...query,
    favoriteIds: query.data ?? [],
    isFavorited: (listingId: string) => idSet.has(listingId),
  };
}
