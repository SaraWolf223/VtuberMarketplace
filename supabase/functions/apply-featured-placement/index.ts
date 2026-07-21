import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

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
    source?: 'pro_seller_credit' | 'paid';
    amount_cents?: number;
    stripe_payment_intent_id?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  if (!body.listing_id) {
    return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
  }

  const source = body.source ?? 'pro_seller_credit';

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.rpc('apply_featured_placement', {
      p_user_id: auth.user.id,
      p_listing_id: body.listing_id,
      p_source: source,
      p_amount_cents: body.amount_cents ?? 0,
      p_stripe_payment_intent_id: body.stripe_payment_intent_id ?? null,
    });

    if (error) {
      return withCors(errorResponse(error.message, 400, 'APPLY_FAILED'));
    }

    return withCors(okResponse(data));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Apply featured failed';
    return withCors(errorResponse(message, 500, 'APPLY_FAILED'));
  }
});
