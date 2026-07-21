import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  applyBoostFromPaymentIntent,
  applyBoostWithPremiumCredit,
  applyBoostWithFoundingCredit,
  applyBoostWithPromoCredit,
} from '../_shared/apply-boost.ts';

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

  let body: {
    listing_id?: string;
    payment_intent_id?: string;
    source?: 'paid' | 'premium_credit' | 'founding_credit' | 'promo';
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const listingId = body.listing_id;
  if (!listingId) {
    return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
  }

  try {
    const admin = createSupabaseAdmin();

    if (body.source === 'premium_credit') {
      const result = await applyBoostWithPremiumCredit(admin, auth.user.id, listingId);
      if (!result.ok) {
        return withCors(errorResponse(result.message, 400, result.code));
      }
      return withCors(
        okResponse({
          listing_id: listingId,
          boosted_until: result.boosted_until,
          expires_at: result.expires_at,
          expiry_extended: result.expiry_extended,
          source: 'premium_credit',
        })
      );
    }

    if (body.source === 'founding_credit') {
      const result = await applyBoostWithFoundingCredit(admin, auth.user.id, listingId);
      if (!result.ok) {
        return withCors(errorResponse(result.message, 400, result.code));
      }
      return withCors(
        okResponse({
          listing_id: listingId,
          boosted_until: result.boosted_until,
          expires_at: result.expires_at,
          expiry_extended: result.expiry_extended,
          source: 'founding_credit',
        })
      );
    }

    if (body.source === 'promo') {
      const result = await applyBoostWithPromoCredit(admin, auth.user.id, listingId);
      if (!result.ok) {
        return withCors(errorResponse(result.message, 400, result.code));
      }
      return withCors(
        okResponse({
          listing_id: listingId,
          boosted_until: result.boosted_until,
          expires_at: result.expires_at,
          expiry_extended: result.expiry_extended,
          source: 'promo',
        })
      );
    }

    const paymentIntentId = body.payment_intent_id;
    if (!paymentIntentId) {
      return withCors(errorResponse('payment_intent_id is required', 400, 'BAD_REQUEST'));
    }

    const result = await applyBoostFromPaymentIntent(admin, paymentIntentId, auth.user.id);
    if (!result.ok) {
      return withCors(errorResponse(result.message, 400, result.code));
    }

    return withCors(
      okResponse({
        listing_id: listingId,
        boosted_until: result.boosted_until,
        expires_at: result.expires_at,
        expiry_extended: result.expiry_extended,
        source: 'paid',
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not apply boost';
    return withCors(errorResponse(message, 500, 'APPLY_BOOST_FAILED'));
  }
});
