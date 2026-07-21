import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { containsBannedKeyword } from '../_shared/moderation.ts';
import { validateCreateListing, type CreateListingInput } from '../_shared/listing-validate.ts';
import { assertListingQuota } from '../_shared/listing-quota.ts';

const MAX_CREATES_PER_HOUR = 10;
const MAX_UPLOAD_SLOTS = 5;
const NEW_ACCOUNT_AGE_DAYS = 7;
const NEW_ACCOUNT_DAILY_CAP = 3;

function extractYoutubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '').slice(0, 11) || null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v.slice(0, 11);
    }
  } catch {
    /* ignore */
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
  if ('response' in auth) return withCors(auth.response);

  let body: CreateListingInput & { image_count?: number };
  try {
    body = (await req.json()) as CreateListingInput & { image_count?: number };
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const imageCount = Math.min(
    MAX_UPLOAD_SLOTS,
    Math.max(3, Number(body.image_count) || 3)
  );

  const validated = validateCreateListing(body);
  if (!validated.ok) {
    return withCors(errorResponse(validated.message, 400, validated.code));
  }

  const data = validated.data;
  const youtubeId = extractYoutubeId(data.youtube_video_url);
  if (!youtubeId) {
    return withCors(errorResponse('Enter a valid YouTube URL', 400, 'INVALID_YOUTUBE'));
  }

  const admin = createSupabaseAdmin();

  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, banned_at, is_premium, premium_until, is_pro_seller, pro_seller_until, phone_verified_at, stripe_charges_enabled, stripe_payouts_enabled, created_at'
    )
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile || profile.banned_at) {
    return withCors(errorResponse('Account cannot create listings', 403, 'BANNED'));
  }

  if (!profile.phone_verified_at) {
    return withCors(
      errorResponse('Phone verification required to sell', 403, 'PHONE_NOT_VERIFIED')
    );
  }

  const isPro =
    (!!profile.is_pro_seller &&
      (!profile.pro_seller_until || new Date(profile.pro_seller_until).getTime() > Date.now())) ||
    (!!profile.is_premium &&
      (!profile.premium_until || new Date(profile.premium_until).getTime() > Date.now()));

  const quota = await assertListingQuota(admin, auth.user.id, isPro);
  if (!quota.ok) {
    return withCors(errorResponse(quota.message, 429, quota.code));
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('listing_create_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .gte('created_at', hourAgo);

  if ((count ?? 0) >= MAX_CREATES_PER_HOUR) {
    return withCors(
      errorResponse('Listing limit reached. Try again in an hour.', 429, 'RATE_LIMIT')
    );
  }

  const accountAgeMs = Date.now() - new Date(profile.created_at as string).getTime();
  const isNewAccount = accountAgeMs < NEW_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (isNewAccount && !isPro) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dayCount } = await admin
      .from('listing_create_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .gte('created_at', dayAgo);
    if ((dayCount ?? 0) >= NEW_ACCOUNT_DAILY_CAP) {
      return withCors(
        errorResponse(
          `New accounts can post ${NEW_ACCOUNT_DAILY_CAP} listings per day.`,
          429,
          'NEW_ACCOUNT_DAILY_CAP'
        )
      );
    }
  }

  const banned = await containsBannedKeyword(
    admin,
    `${data.title} ${data.description ?? ''} ${data.license_text}`
  );
  if (banned) {
    return withCors(
      errorResponse('Listing contains prohibited language', 400, 'BANNED_KEYWORD')
    );
  }

  const { data: listingId, error: insertError } = await admin.rpc('insert_draft_listing', {
    p_seller_id: auth.user.id,
    p_title: data.title,
    p_description: data.description,
    p_price: data.price,
    p_category: data.category,
    p_asset_type: data.asset_type,
    p_license_type: data.license_type,
    p_license_text: data.license_text,
    p_download_url: data.download_url,
    p_is_mature: data.is_mature,
    p_support_duration: data.support_duration,
    p_compatible_software: data.compatible_software,
    p_file_formats: data.file_formats,
    p_includes_source_files: data.includes_source_files,
    p_credits_text: data.credits_text,
    p_asset_fields: data.asset_fields,
  });

  if (insertError || !listingId) {
    console.error('create listing', insertError?.message);
    if (insertError?.message?.includes('INVALID_CATEGORY')) {
      return withCors(errorResponse('Invalid category', 400, 'INVALID_CATEGORY'));
    }
    return withCors(
      errorResponse(insertError?.message ?? 'Could not create listing', 500, 'DB_ERROR')
    );
  }

  await admin
    .from('listings')
    .update({
      youtube_video_url: data.youtube_video_url,
      youtube_video_id: youtubeId,
      youtube_video_status: 'unchecked',
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);

  await admin.from('listing_create_log').insert({ user_id: auth.user.id });

  const upload_urls: Array<{
    sort_order: number;
    storage_path: string;
    signed_url: string;
    token: string;
  }> = [];

  for (let i = 0; i < imageCount; i += 1) {
    const storage_path = `${auth.user.id}/${listingId}/${i}.jpg`;
    const { data: signed, error: signError } = await admin.storage
      .from('listing-images')
      .createSignedUploadUrl(storage_path, { upsert: true });

    if (signError || !signed) {
      return withCors(errorResponse('Could not prepare image upload', 500, 'STORAGE_ERROR'));
    }

    upload_urls.push({
      sort_order: i,
      storage_path,
      signed_url: signed.signedUrl,
      token: signed.token,
    });
  }

  return withCors(
    okResponse({
      listing_id: listingId as string,
      upload_urls,
    })
  );
});
