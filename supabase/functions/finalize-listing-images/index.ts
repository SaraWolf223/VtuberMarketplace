import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import {
  listingExpiresAt,
  listingPurgeAt,
} from '../_shared/listing-lifecycle.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  isJpegBytes,
  validateImageMeta,
  MAX_LISTING_IMAGE_BYTES,
} from '../_shared/listing-images.ts';

type ImageMeta = {
  sort_order?: number;
  storage_path?: string;
  byte_size?: number;
  width?: number | null;
  height?: number | null;
};

type FinalizeBody = {
  listing_id?: string;
  images?: ImageMeta[];
};

async function verifyStoredJpeg(
  admin: ReturnType<typeof createSupabaseAdmin>,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await admin.storage.from('listing-images').download(storagePath);

  if (error || !data) {
    return 'Image file missing in storage';
  }

  const bytes = new Uint8Array(await data.arrayBuffer());

  if (bytes.length > MAX_LISTING_IMAGE_BYTES) {
    return 'Image exceeds 2MB limit';
  }

  if (!isJpegBytes(bytes)) {
    return 'File is not a valid JPEG image';
  }

  return null;
}

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireUser(req);
  if ('response' in auth) {
    return withCors(auth.response);
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const listingId = body.listing_id;
  const images = body.images ?? [];

  if (!listingId) {
    return withCors(errorResponse('listing_id is required', 400, 'VALIDATION'));
  }

  if (images.length < 1 || images.length > 5) {
    return withCors(
      errorResponse('Upload between 1 and 5 images', 400, 'IMAGE_LIMIT')
    );
  }

  const admin = createSupabaseAdmin();

  const { data: listing, error: listingError } = await admin
    .from('listings')
    .select('id, seller_id, status')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError || !listing) {
    return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
  }

  if (listing.seller_id !== auth.user.id) {
    return withCors(errorResponse('Not your listing', 403, 'NOT_OWNER'));
  }

  // Only a freshly created draft may be published here. This prevents
  // re-activating a listing that was auto-paused for moderation
  // (paused_pending_review), expired, or sold.
  if (listing.status !== 'draft') {
    return withCors(
      errorResponse('Listing is not a draft and cannot be published', 409, 'NOT_DRAFT')
    );
  }

  // Re-check seller eligibility at publish time (mirror create-listing): a user
  // banned or unverified after drafting must not be able to finalize.
  const { data: sellerGate } = await admin
    .from('profiles')
    .select('banned_at, phone_verified_at')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!sellerGate || sellerGate.banned_at) {
    return withCors(errorResponse('Account cannot publish listings', 403, 'BANNED'));
  }

  if (!sellerGate.phone_verified_at) {
    return withCors(
      errorResponse('Phone verification required to publish listings', 403, 'PHONE_NOT_VERIFIED')
    );
  }

  const rows: Array<{
    listing_id: string;
    storage_path: string;
    thumb_path: string;
    sort_order: number;
    byte_size: number;
    width: number | null;
    height: number | null;
  }> = [];

  for (let idx = 0; idx < images.length; idx += 1) {
    const img = images[idx];
    const sort = Number(img.sort_order ?? idx);
    const path = img.storage_path?.trim() ?? '';
    const byteSize = Number(img.byte_size) || 0;
    const width = img.width ?? null;
    const height = img.height ?? null;

    const metaError = validateImageMeta(
      auth.user.id,
      listingId,
      sort,
      path,
      byteSize,
      width,
      height
    );
    if (metaError) {
      return withCors(errorResponse(metaError, 400, 'VALIDATION'));
    }

    if (sort < 0 || sort > 4) {
      return withCors(errorResponse('Invalid image order', 400, 'VALIDATION'));
    }

    const fileError = await verifyStoredJpeg(admin, path);
    if (fileError) {
      return withCors(errorResponse(fileError, 400, 'INVALID_IMAGE'));
    }

    rows.push({
      listing_id: listingId,
      storage_path: path,
      thumb_path: path,
      sort_order: sort,
      byte_size: byteSize,
      width,
      height,
    });
  }

  const { error: deleteError } = await admin
    .from('listing_images')
    .delete()
    .eq('listing_id', listingId);

  if (deleteError) {
    console.error('clear images', deleteError.message);
  }

  const { error: insertError } = await admin.from('listing_images').insert(rows);

  if (insertError) {
    console.error('insert images', insertError.message);
    return withCors(errorResponse('Could not save images', 500, 'DB_ERROR'));
  }

  const now = new Date().toISOString();
  const publishAt = new Date();

  const { data: sellerProfile } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', listing.seller_id)
    .maybeSingle();

  const premiumActive =
    !!sellerProfile?.is_premium &&
    (!sellerProfile.premium_until ||
      new Date(sellerProfile.premium_until).getTime() > publishAt.getTime());

  const { data: published, error: updateError } = await admin
    .from('listings')
    .update({
      status: 'active',
      image_count: rows.length,
      published_at: now,
      expires_at: listingExpiresAt(publishAt, premiumActive),
      purge_at: listingPurgeAt(publishAt, premiumActive),
      updated_at: now,
    })
    .eq('id', listingId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('activate listing', updateError.message);
    return withCors(errorResponse('Could not publish listing', 500, 'DB_ERROR'));
  }

  if (!published) {
    return withCors(errorResponse('Listing is not a draft and cannot be published', 409, 'NOT_DRAFT'));
  }

  return withCors(
    okResponse({
      listing_id: listingId,
      status: 'active',
      image_count: rows.length,
    })
  );
});
