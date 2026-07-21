import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { fetchListingDetail } from '@/features/listings/listing-detail-service';
import { useToggleFavorite } from '@/hooks/useToggleFavorite';
import { AnalyticsEvents, trackEvent } from '@/lib/analytics';

export function useListingDetail(listingId: string | undefined) {
  const { session } = useAuth();
  const token = session?.access_token;
  const toggleFavorite = useToggleFavorite();

  const query = useQuery({
    queryKey: queryKeys.listing(listingId ?? ''),
    queryFn: () => fetchListingDetail(token!, listingId!),
    enabled: !!listingId && !!token,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data?.listing && listingId) {
      trackEvent(AnalyticsEvents.listingViewed, {
        listing_id: listingId,
        category: query.data.listing.category,
        price: query.data.listing.price,
        is_own: query.data.listing.is_own,
      });
    }
  }, [query.data?.listing, listingId]);

  return {
    ...query,
    toggleFavorite: (next: boolean) => {
      if (!listingId) return;
      toggleFavorite.mutate(
        { listingId, favorited: next },
        {
          onError: (e) => {
            Alert.alert(
              'Could not update favorite',
              e instanceof Error ? e.message : 'Try again'
            );
          },
        }
      );
    },
    isFavoriteLoading: toggleFavorite.isPending,
  };
}
