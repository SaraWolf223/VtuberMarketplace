import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchMyListings,
  markListingSold,
  deleteListingPermanently,
} from '@/features/listings/my-listings-service';
import { invalidateFeedQueries } from '@/features/profile/prefs-service';
import type { MyListingStatus } from '@/types/my-listings';

export function useMyListings(status: MyListingStatus) {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const token = session?.access_token;
  const userId = user?.id;

  const query = useQuery({
    queryKey: queryKeys.myListings(status),
    queryFn: () => fetchMyListings(token!, userId!, status),
    enabled: !!token && !!userId,
  });

  const invalidateAll = () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    invalidateFeedQueries(queryClient, userId);
    queryClient.invalidateQueries({ queryKey: ['listing'] });
  };

  const markSoldMutation = useMutation({
    mutationFn: (listingId: string) => markListingSold(token!, listingId),
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (listingId: string) => deleteListingPermanently(token!, listingId),
    onSuccess: invalidateAll,
  });

  return {
    ...query,
    markSold: markSoldMutation.mutate,
    removeListing: deleteMutation.mutate,
    isMarkingSold: markSoldMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
