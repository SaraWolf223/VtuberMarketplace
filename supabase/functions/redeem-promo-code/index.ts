// TODO(VtuberMarketplace): order discounts are applied in create-order-checkout, not here.
// See docs/10-Monetization_System.md + migration 132 — legacy boost/premium promo redemption.
import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type RedeemResult = {
  type: 'free_boosts' | 'free_premium_month' | 'founding_seller';
  boosts_remaining?: number;
  premium_until?: string;
  message: string;
};

function mapPromoError(raw: string): { message: string; status: number; code: string } {
  if (raw.includes('RATE_LIMIT')) {
    return {
      message: 'Too many attempts. Wait an hour and try again.',
      status: 429,
      code: 'RATE_LIMIT',
    };
  }
  if (raw.includes('ALREADY_REDEEMED')) {
    return {
      message: 'You already redeemed this code.',
      status: 409,
      code: 'ALREADY_REDEEMED',
    };
  }
  if (raw.includes('PREMIUM_PROMO_ALREADY_USED')) {
    return {
      message: 'Your account already used a free Premium promo code.',
      status: 409,
      code: 'PREMIUM_PROMO_ALREADY_USED',
    };
  }
  if (raw.includes('FOUNDING_ALREADY')) {
    return {
      message: 'This account is already a Founding Seller.',
      status: 409,
      code: 'FOUNDING_ALREADY',
    };
  }
  if (raw.includes('WAITLIST_EMAIL_MISMATCH')) {
    return {
      message:
        'This Founding Seller code was issued to a different email. Sign in with the same email you used on the waitlist, or contact support.',
      status: 403,
      code: 'WAITLIST_EMAIL_MISMATCH',
    };
  }
  if (raw.includes('PHONE_REQUIRED')) {
    return {
      message: 'Verify your phone number before redeeming a promo code.',
      status: 403,
      code: 'PHONE_REQUIRED',
    };
  }
  if (raw.includes('FORBIDDEN') || raw.includes('NOT_AUTHENTICATED')) {
    return { message: 'Account not available.', status: 403, code: 'FORBIDDEN' };
  }
  return {
    message: 'This promo code is invalid or no longer available.',
    status: 400,
    code: 'INVALID_CODE',
  };
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

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const code = body.code?.trim();
  if (!code) {
    return withCors(errorResponse('code is required', 400, 'BAD_REQUEST'));
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc('apply_promo_redemption', {
    p_user_id: auth.user.id,
    p_code: code,
  });

  if (error) {
    const mapped = mapPromoError(error.message);
    return withCors(errorResponse(mapped.message, mapped.status, mapped.code));
  }

  return withCors(okResponse(data as RedeemResult));
});
