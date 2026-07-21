import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { createReview } from '@/features/reviews/review-service';

type CreateReviewInput = {
  orderId: string;
  listingId: string;
  sellerId: string;
  rating: number;
  body?: string;
};

export function useCreateReview() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const token = session?.access_token;

  return useMutation({
    mutationFn: ({ orderId, rating, body }: CreateReviewInput) => {
      if (!token) throw new Error('Sign in to leave a review');
      if (!orderId) throw new Error('Complete a fulfilled purchase before leaving a review.');
      return createReview(token, orderId, rating, body);
    },
    onSuccess: (_id, { listingId, sellerId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.listingReviewStatus(listingId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.listing(listingId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicProfile(sellerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerReviews(sellerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(sellerId) });
    },
  });
}
