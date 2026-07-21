import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const BUCKET = 'listing-images';

/** Retarget listing reports before delete — FK SET NULL would violate reports_target_check. */
async function detachListingReports(
  admin: SupabaseClient,
  listingId: string,
  sellerId: string,
  reviewedBy?: string | null
): Promise<void> {
  const now = new Date().toISOString();

  if (reviewedBy) {
    const { error: closeError } = await admin
      .from('reports')
      .update({
        status: 'reviewed',
        reviewed_at: now,
        reviewed_by: reviewedBy,
      })
      .eq('listing_id', listingId)
      .eq('status', 'open');

    if (closeError) {
      throw new Error(closeError.message);
    }
  }

  const { error: retargetError } = await admin
    .from('reports')
    .update({
      target_type: 'user',
      reported_user_id: sellerId,
    })
    .eq('listing_id', listingId)
    .eq('target_type', 'listing');

  if (retargetError) {
    throw new Error(retargetError.message);
  }
}

export async function hardDeleteListing(
  admin: SupabaseClient,
  listingId: string,
  options?: { reviewedBy?: string | null }
): Promise<{ deleted: boolean }> {
  const { data: listing, error: listingError } = await admin
    .from('listings')
    .select('seller_id')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) {
    throw new Error(listingError.message);
  }
  if (!listing?.seller_id) {
    throw new Error('Listing not found');
  }

  await detachListingReports(admin, listingId, listing.seller_id, options?.reviewedBy);

  const { data: images } = await admin
    .from('listing_images')
    .select('storage_path, thumb_path')
    .eq('listing_id', listingId);

  const paths = new Set<string>();
  for (const img of images ?? []) {
    if (img.storage_path) paths.add(img.storage_path);
    if (img.thumb_path) paths.add(img.thumb_path);
  }

  if (paths.size > 0) {
    const pathList = [...paths];
    const { error: storageError } = await admin.storage.from(BUCKET).remove(pathList);
    if (storageError) {
      console.warn('[hardDeleteListing] storage remove:', storageError.message);
    }
  }

  const { error: deleteError } = await admin.from('listings').delete().eq('id', listingId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return { deleted: true };
}
