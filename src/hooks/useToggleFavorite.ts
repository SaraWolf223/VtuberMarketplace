import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { setFavorite } from '@/features/favorites/favorites-service';

export function useToggleFavorite() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const token = session?.access_token;

  return useMutation({
    mutationFn: async ({
      listingId,
      favorited,
    }: {
      listingId: string;
      favorited: boolean;
    }) => {
      if (!token || !userId) throw new Error('Sign in to save favorites');
      await setFavorite(token, listingId, favorited, userId);
    },
    onSuccess: (_data, { listingId }) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.favoriteIds(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.listing(listingId) });
    },
  });
}
