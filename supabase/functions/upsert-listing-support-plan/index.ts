import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';

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

  let body: {
    listing_id?: string;
    price_cents_month?: number;
    offerings_text?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return withCors(errorResponse('Invalid JSON', 400, 'INVALID_JSON'));
  }

  const listingId = body.listing_id;
  const priceCents = body.price_cents_month;
  const offerings = (body.offerings_text ?? '').trim();
  const active = body.active === true;

  if (!listingId || !priceCents || priceCents <= 0 || offerings.length < 1) {
    return withCors(errorResponse('Missing plan fields', 400, 'VALIDATION'));
  }

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: listing, error: listingErr } = await admin
      .from('listings')
      .select('id, seller_id, title, asset_type, category')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing || listing.seller_id !== auth.user.id) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    const eligible =
      listing.asset_type === 'live2d_2d' ||
      listing.asset_type === 'model_3d' ||
      listing.category === 'vrchat';
    if (!eligible) {
      return withCors(
        errorResponse('Listing type not eligible for support plans', 400, 'LISTING_NOT_ELIGIBLE')
      );
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_connect_account_id, connect_charges_enabled')
      .eq('id', auth.user.id)
      .single();

    if (!profile?.stripe_connect_account_id || !profile.connect_charges_enabled) {
      return withCors(
        errorResponse('Complete Stripe Connect onboarding first', 400, 'SELLER_NOT_PAYOUT_READY')
      );
    }

    const { data: existing } = await admin
      .from('listing_support_plans')
      .select('*')
      .eq('listing_id', listingId)
      .maybeSingle();

    let productId = existing?.stripe_product_id as string | null;
    let priceId = existing?.stripe_price_id as string | null;

    // Product/Price live on the *platform* account so Checkout can use destination
    // charges (transfer_data + application_fee_percent) to the seller Connect account.
    if (!productId) {
      const product = await stripe.products.create({
        name: `Support: ${listing.title}`,
        metadata: {
          listing_id: listingId,
          seller_id: auth.user.id,
          connect_account_id: profile.stripe_connect_account_id,
        },
      });
      productId = product.id;
    }

    if (!priceId || existing?.price_cents_month !== priceCents) {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: priceCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: {
          listing_id: listingId,
          seller_id: auth.user.id,
          connect_account_id: profile.stripe_connect_account_id,
        },
      });
      priceId = price.id;
    }

    const row = {
      listing_id: listingId,
      active,
      price_cents_month: priceCents,
      offerings_text: offerings.slice(0, 2000),
      stripe_product_id: productId,
      stripe_price_id: priceId,
      updated_at: new Date().toISOString(),
    };

    const { data: plan, error: upsertErr } = await admin
      .from('listing_support_plans')
      .upsert(row, { onConflict: 'listing_id' })
      .select('*')
      .single();

    if (upsertErr || !plan) {
      return withCors(errorResponse(upsertErr?.message ?? 'Upsert failed', 500, 'DB'));
    }

    return withCors(okResponse({ plan }));
  } catch (e) {
    console.error('upsert-listing-support-plan', e);
    return withCors(errorResponse('Server error', 500, 'SERVER'));
  }
});
