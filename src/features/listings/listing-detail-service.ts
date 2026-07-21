import { supabaseRpc, getSupabaseEnv } from '@/lib/supabase-rest';
import type { ListingDetailResponse } from '@/types/listing-detail';

export { setFavorite } from '@/features/favorites/favorites-service';

type DetailRpcResult = ListingDetailResponse | { error: string };

export async function fetchListingDetail(
  accessToken: string,
  listingId: string
): Promise<ListingDetailResponse> {
  const result = await supabaseRpc<DetailRpcResult>(
    'get_listing_detail',
    { p_listing_id: listingId },
    accessToken
  );

  if ('error' in result && result.error) {
    throw new Error('Listing not found');
  }

  return result as ListingDetailResponse;
}

export async function revealSellerPhone(
  accessToken: string,
  listingId: string
): Promise<string | null> {
  const result = await supabaseRpc<{ phone: string | null }>(
    'reveal_seller_phone',
    { p_listing_id: listingId },
    accessToken
  );
  return result.phone ?? null;
}

export async function submitListingReport(
  accessToken: string,
  listingId: string,
  _reporterId: string,
  reason: string,
  details?: string
): Promise<void> {
  const { submitReport } = await import('@/features/moderation/moderation-service');
  await submitReport(accessToken, {
    target_type: 'listing',
    listing_id: listingId,
    reason: reason as import('@/features/moderation/moderation-service').ReportReason,
    details,
  });
}

export async function recordListingInterest(
  accessToken: string,
  listingId: string
): Promise<void> {
  const { url, key } = getSupabaseEnv();

  const res = await fetch(`${url}/rest/v1/rpc/record_listing_interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ p_listing_id: listingId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Could not record interest');
  }
}
