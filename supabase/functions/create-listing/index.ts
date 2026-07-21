import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { resolveZipCentroid } from '../_shared/zip-lookup.ts';
import { containsBannedKeyword } from '../_shared/moderation.ts';
import { validateCreateListing, type CreateListingInput } from '../_shared/listing-validate.ts';
import { assertListingQuota } from '../_shared/listing-quota.ts';

const MAX_CREATES_PER_HOUR = 10;
const MAX_UPLOAD_SLOTS = 5;
// Anti-farming: brand-new free accounts are limited to a few listings/day.
// Vetted sellers (Premium-comped seed cohort, Founding Sellers) are exempt.
const NEW_ACCOUNT_AGE_DAYS = 7;
const NEW_ACCOUNT_DAILY_CAP = 3;

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

  let body: CreateListingInput;
  try {
    body = (await req.json()) as CreateListingInput;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const imageCount = Math.min(
    MAX_UPLOAD_SLOTS,
    Math.max(1, Number((body as { image_count?: number }).image_count) || 1)
  );

  const validated = validateCreateListing(body);
  if (!validated.ok) {
    return withCors(errorResponse(validated.message, 400, validated.code));
  }

  const { title, description, price, category, zip_code } = validated.data;
  const admin = createSupabaseAdmin();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, banned_at, is_premium, premium_until, phone_verified_at, created_at, is_founding_seller')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!profile || profile.banned_at) {
    return withCors(errorResponse('Account cannot create listings', 403, 'BANNED'));
  }

  if (!profile.phone_verified_at) {
    return withCors(
      errorResponse('Phone verification required to publish listings', 403, 'PHONE_NOT_VERIFIED')
    );
  }

  const isPremium =
    !!profile.is_premium &&
    (!profile.premium_until || new Date(profile.premium_until).getTime() > Date.now());

  const quota = await assertListingQuota(admin, auth.user.id, isPremium);
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

  // New-account daily cap (anti-farming). Vetted sellers are exempt.
  const accountAgeMs = Date.now() - new Date(profile.created_at as string).getTime();
  const isNewAccount = accountAgeMs < NEW_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
  const isVetted = isPremium || !!profile.is_founding_seller;
  if (isNewAccount && !isVetted) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dayCount } = await admin
      .from('listing_create_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .gte('created_at', dayAgo);

    if ((dayCount ?? 0) >= NEW_ACCOUNT_DAILY_CAP) {
      return withCors(
        errorResponse(
          `New accounts can post ${NEW_ACCOUNT_DAILY_CAP} listings per day. Try again tomorrow.`,
          429,
          'NEW_ACCOUNT_DAILY_CAP'
        )
      );
    }
  }

  const banned = await containsBannedKeyword(admin, `${title} ${description ?? ''}`);
  if (banned) {
    return withCors(
      errorResponse('Listing contains prohibited language', 400, 'BANNED_KEYWORD')
    );
  }

  const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
  const zipResult = await resolveZipCentroid(admin, zip_code, mapboxToken);
  if (!zipResult.ok) {
    return withCors(errorResponse(zipResult.message, zipResult.code === 'GEO_CONFIG' ? 500 : 400, zipResult.code));
  }
  const geo = zipResult.data;

  const { data: listingId, error: insertError } = await admin.rpc('insert_draft_listing', {
    p_seller_id: auth.user.id,
    p_title: title,
    p_description: description,
    p_price: price,
    p_category: category,
    p_zip_code: zip_code,
    p_lng: geo.lng,
    p_lat: geo.lat,
  });

  if (insertError || !listingId) {
    console.error('create listing', insertError?.message);
    if (insertError?.message?.includes('INVALID_CATEGORY')) {
      return withCors(errorResponse('Invalid category', 400, 'INVALID_CATEGORY'));
    }
    return withCors(errorResponse('Could not create listing', 500, 'DB_ERROR'));
  }

  const listing = { id: listingId as string };

  await admin.from('listing_create_log').insert({ user_id: auth.user.id });

  const upload_urls: Array<{
    sort_order: number;
    storage_path: string;
    signed_url: string;
    token: string;
  }> = [];

  for (let i = 0; i < imageCount; i += 1) {
    const storage_path = `${auth.user.id}/${listing.id}/${i}.jpg`;
    const { data: signed, error: signError } = await admin.storage
      .from('listing-images')
      .createSignedUploadUrl(storage_path, { upsert: true });

    if (signError || !signed) {
      console.error('signed url', signError?.message);
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
      listing_id: listing.id,
      lat: geo.lat,
      lng: geo.lng,
      city: geo.city,
      state: geo.state,
      upload_urls,
    })
  );
});
