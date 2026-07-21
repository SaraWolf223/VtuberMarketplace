import { supabaseRestGet, supabaseRpc, getSupabaseEnv } from '@/lib/supabase-rest';
import { geocodeZip } from '@/features/profile/geocode-zip';
import type { ListingFormValues } from '@/features/listings/listing-schema';
import type { MyListingItem, MyListingStatus } from '@/types/my-listings';

const LISTING_SELECT =
  'id,title,description,price,category,zip_code,status,expires_at,published_at,boosted_until,listing_images(storage_path,thumb_path,sort_order)';

export async function fetchMyListings(
  accessToken: string,
  sellerId: string,
  status: MyListingStatus
): Promise<MyListingItem[]> {
  const order = status === 'active' ? 'expires_at.asc' : 'published_at.desc';
  const statusFilter =
    status === 'active'
      ? 'status=in.(active,paused_pending_review)'
      : `status=eq.${status}`;

  const rows = await supabaseRestGet<MyListingItem>(
    `listings?seller_id=eq.${sellerId}&${statusFilter}&select=${LISTING_SELECT}&order=${order}`,
    accessToken
  );
  return rows.map((row) => ({
    ...row,
    price: Number(row.price),
    listing_images: [...(row.listing_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));
}

export async function markListingSold(
  accessToken: string,
  listingId: string
): Promise<void> {
  const result = await supabaseRpc<{ ok?: boolean; error?: string }>(
    'seller_mark_listing_sold',
    { p_listing_id: listingId },
    accessToken
  );

  if ('error' in result && result.error) {
    if (result.error === 'NOT_ACTIVE') {
      // Server allows this for both `active` and `paused_pending_review` —
      // it only rejects listings that are already sold/expired/deleted.
      throw new Error('This listing can no longer be marked sold.');
    }
    throw new Error('Listing not found');
  }
}

export async function deleteListingPermanently(
  accessToken: string,
  listingId: string
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/delete-listing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ listing_id: listingId }),
  });

  const json = (await res.json()) as {
    ok: boolean;
    error?: { message?: string };
  };

  if (!json.ok) {
    throw new Error(json.error?.message ?? 'Could not delete listing');
  }
}

/** @deprecated Use deleteListingPermanently */
export const softDeleteListing = deleteListingPermanently;

type UpdateRpcResult = { id: string } | { error: string; keyword?: string };

export async function updateListingMetadata(
  accessToken: string,
  listingId: string,
  values: ListingFormValues
): Promise<void> {
  const geo = await geocodeZip(values.zip_code, accessToken);

  const result = await supabaseRpc<UpdateRpcResult>(
    'update_listing',
    {
      p_listing_id: listingId,
      p_title: values.title,
      p_description: values.description ?? null,
      p_price: values.price,
      p_category: values.category,
      p_zip_code: values.zip_code,
      p_lat: geo.lat,
      p_lng: geo.lng,
    },
    accessToken
  );

  if ('error' in result && result.error) {
    if (result.error === 'NOT_EDITABLE') {
      throw new Error('Only active listings can be edited.');
    }
    if (result.error === 'INVALID_CATEGORY') {
      throw new Error('Choose a valid category — the one selected is no longer available.');
    }
    if (result.error === 'BANNED_KEYWORD') {
      const keyword =
        'keyword' in result && typeof result.keyword === 'string' ? result.keyword : 'restricted';
      throw new Error(`Listing text is not allowed (restricted term: ${keyword}).`);
    }
    throw new Error('Listing not found');
  }
}

export function myListingThumbPath(item: MyListingItem): string | null {
  const first = item.listing_images[0];
  return first?.thumb_path ?? first?.storage_path ?? null;
}
