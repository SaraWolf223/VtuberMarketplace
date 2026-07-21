import type { ListingReviewStatus } from '@/types/reviews';

export function reviewProgressHint(status: ListingReviewStatus): string {
  if (status.can_review) {
    return 'You can rate this seller after your fulfilled purchase.';
  }

  if (status.has_order) {
    return 'Your order is not fulfilled yet. Reviews unlock after delivery is complete.';
  }

  return 'Reviews are purchase-verified. Complete a fulfilled order for this listing to leave a review.';
}
