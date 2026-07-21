// TODO(VtuberMarketplace): superseded by create-featured-checkout + apply-featured-placement.
// See docs/10-Monetization_System.md §5 — legacy hyperlocal Boost flow; keep deployed until client migrates.
import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { getAvailablePremiumCredit } from '../_shared/premium-credits.ts';
import { getAvailableFoundingCredit } from '../_shared/founding-credits.ts';
import { grossUpForStripeFees } from '../_shared/stripe-processing-fee.ts';
import { getBoostBaseCents } from '../_shared/platform-settings.ts';
import { getAvailablePromoBoost } from '../_shared/promo-boosts.ts';

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

  let body: { listing_id?: string; force_paid?: boolean };
  try {
    body = (await req.json()) as { listing_id?: string; force_paid?: boolean };
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const listingId = body.listing_id;
  if (!listingId) {
    return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
  }

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id, seller_id, status, title')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    if (listing.seller_id !== auth.user.id) {
      return withCors(errorResponse('Not your listing', 403, 'FORBIDDEN'));
    }

    if (listing.status !== 'active') {
      return withCors(
        errorResponse('Only active listings can be boosted', 400, 'LISTING_INACTIVE')
      );
    }

    const credit = body.force_paid
      ? null
      : await getAvailablePremiumCredit(admin, auth.user.id);
    if (credit) {
      return withCors(
        okResponse({
          use_credit: true,
          credits_remaining: credit.remaining,
          credits_total: credit.credits_total,
        })
      );
    }

    const founding = body.force_paid
      ? null
      : await getAvailableFoundingCredit(admin, auth.user.id);
    if (founding) {
      return withCors(
        okResponse({
          use_founding: true,
          founding_credits_remaining: founding.remaining,
          founding_credits_total: founding.credits_total,
        })
      );
    }

    const promo = body.force_paid ? null : await getAvailablePromoBoost(admin, auth.user.id);
    if (promo) {
      return withCors(
        okResponse({
          use_promo: true,
          promo_boosts_remaining: promo.remaining,
        })
      );
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return withCors(errorResponse('Profile not found', 404, 'PROFILE_NOT_FOUND'));
    }

    let customerId = profile.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { user_id: auth.user.id },
      });
      customerId = customer.id;
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', auth.user.id);
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2024-11-20.acacia' }
    );

    const boostBaseCents = await getBoostBaseCents(admin);
    const charge = grossUpForStripeFees(boostBaseCents);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: charge.total_cents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: 'boost_24h',
        listing_id: listingId,
        user_id: auth.user.id,
        listing_title: listing.title?.slice(0, 100) ?? '',
        base_amount_cents: String(charge.base_cents),
        processing_fee_cents: String(charge.processing_fee_cents),
      },
    });

    if (!paymentIntent.client_secret) {
      return withCors(errorResponse('Could not create payment', 500, 'STRIPE_ERROR'));
    }

    return withCors(
      okResponse({
        use_credit: false,
        payment_intent_id: paymentIntent.id,
        payment_intent_client_secret: paymentIntent.client_secret,
        customer_id: customerId,
        ephemeral_key: ephemeralKey.secret,
        base_amount_cents: charge.base_cents,
        processing_fee_cents: charge.processing_fee_cents,
        amount_cents: charge.total_cents,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Boost checkout failed';
    if (message.includes('STRIPE_SECRET_KEY')) {
      return withCors(errorResponse('Payments not configured', 503, 'STRIPE_CONFIG'));
    }
    return withCors(errorResponse(message, 500, 'STRIPE_ERROR'));
  }
});
