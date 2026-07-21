import { supabaseRpc, supabaseRestGet } from '@/lib/supabase-rest';
import type { ListingReviewStatus, PublicProfile, SellerReview } from '@/types/reviews';

type StatusResult = ListingReviewStatus | { error: string };
type CreateResult = { id: string } | { error: string };

export async function fetchListingReviewStatus(
  accessToken: string,
  listingId: string
): Promise<ListingReviewStatus> {
  const result = await supabaseRpc<StatusResult>(
    'get_listing_review_status',
    { p_listing_id: listingId },
    accessToken
  );

  if ('error' in result) {
    throw new Error('Listing not found');
  }

  return result;
}

export async function createReview(
  accessToken: string,
  orderId: string,
  rating: number,
  body?: string
): Promise<string> {
  const result = await supabaseRpc<CreateResult>(
    'create_review',
    {
      p_order_id: orderId,
      p_rating: rating,
      p_body: body?.trim() || null,
    },
    accessToken
  );

  if ('error' in result) {
    const messages: Record<string, string> = {
      ORDER_NOT_FULFILLED:
        'Reviews unlock after your order is fulfilled. Check your library for delivery status.',
      NOT_BUYER: 'Only the buyer on a fulfilled order can leave a review.',
      ALREADY_REVIEWED: 'You already reviewed this listing.',
      INVALID_RATING: 'Choose a rating from 1 to 5 stars.',
      BODY_TOO_LONG: 'Review text must be 300 characters or less.',
      NOT_FOUND: 'Order not found.',
    };
    throw new Error(messages[result.error] ?? 'Could not submit review');
  }

  return result.id;
}

function mapPublicProfile(row: PublicProfile): PublicProfile {
  return {
    ...row,
    rating_avg: Number(row.rating_avg),
    rating_count: Number(row.rating_count),
    listing_count: Number(row.listing_count),
  };
}

export async function fetchPublicProfile(
  accessToken: string,
  userId: string
): Promise<PublicProfile | null> {
  const rows = await supabaseRestGet<PublicProfile>(
    `profiles_public?id=eq.${userId}&select=id,username,display_name,avatar_url,rating_avg,rating_count,listing_count,is_pro_seller,created_at,is_admin,website_url,portfolio_url,social_links,shop_banner_url,shop_accent_color`,
    accessToken
  );
  if (rows[0]) {
    return mapPublicProfile(rows[0]);
  }

  // Staff can read hidden/banned profiles via the get_staff_visible_profile RPC
  // (raw `profiles` SELECT RLS is admin-only — migration 116 — so this can't be
  // a direct table read; the RPC exposes only non-PII columns to managers too).
  // Non-staff callers get a `Forbidden` exception here, not empty rows like the
  // old direct-table read — treat that the same as "not visible" rather than a
  // hard error, since most viewers of a banned/hidden profile are regular users.
  try {
    const staffRow = await supabaseRpc<PublicProfile | null>(
      'get_staff_visible_profile',
      { p_user_id: userId },
      accessToken
    );
    if (!staffRow) return null;
    return mapPublicProfile(staffRow);
  } catch {
    return null;
  }
}

export async function fetchSellerReviews(
  accessToken: string,
  sellerId: string
): Promise<SellerReview[]> {
  const result = await supabaseRpc<SellerReview[] | null>(
    'get_seller_reviews',
    { p_seller_id: sellerId, p_limit: 20 },
    accessToken
  );
  return result ?? [];
}
