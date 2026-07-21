import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import {
  fetchPublicProfile,
  fetchSellerReviews,
} from '@/features/reviews/review-service';

export function usePublicProfile(userId: string | undefined) {
  const { session, isSignedIn } = useAuth();
  const token = session?.access_token;

  const profileQuery = useQuery({
    queryKey: queryKeys.publicProfile(userId ?? ''),
    queryFn: () => fetchPublicProfile(token!, userId!),
    enabled: isSignedIn && !!userId && !!token,
    staleTime: 120_000,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.sellerReviews(userId ?? ''),
    queryFn: () => fetchSellerReviews(token!, userId!),
    enabled: isSignedIn && !!userId && !!token,
    staleTime: 60_000,
  });

  return {
    profile: profileQuery.data,
    reviews: reviewsQuery.data ?? [],
    isLoading: profileQuery.isPending || reviewsQuery.isPending,
    isRefetching: profileQuery.isRefetching || reviewsQuery.isRefetching,
    error: profileQuery.error ?? reviewsQuery.error,
    refetch: () => {
      void profileQuery.refetch();
      void reviewsQuery.refetch();
    },
  };
}
