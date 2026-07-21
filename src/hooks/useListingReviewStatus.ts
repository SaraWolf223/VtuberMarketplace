import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { fetchListingReviewStatus } from '@/features/reviews/review-service';

export function useListingReviewStatus(listingId: string | undefined, enabled = true) {
  const { session, isSignedIn } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: queryKeys.listingReviewStatus(listingId ?? ''),
    queryFn: () => fetchListingReviewStatus(token!, listingId!),
    enabled: enabled && isSignedIn && !!listingId && !!token,
    staleTime: 30_000,
  });
}
