import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  syncProSellerForStripeCustomer,
  syncProSellerFromCheckoutSession,
} from '../_shared/apply-pro-seller.ts';

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

  let body: { session_id?: string } = {};
  try {
    body = (await req.json()) as { session_id?: string };
  } catch {
    body = {};
  }

  try {
    const admin = createSupabaseAdmin();
    let result = { pro_seller_active: false, pro_seller_until: null as string | null };

    if (body.session_id) {
      result = await syncProSellerFromCheckoutSession(admin, auth.user.id, body.session_id);
    }

    if (!result.pro_seller_active) {
      const { data: profile } = await admin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', auth.user.id)
        .single();
      if (profile?.stripe_customer_id) {
        result = await syncProSellerForStripeCustomer(
          admin,
          auth.user.id,
          profile.stripe_customer_id as string
        );
      }
    }

    return withCors(
      okResponse({
        ...result,
        premium_active: result.pro_seller_active,
        premium_until: result.pro_seller_until,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not sync Pro Seller';
    return withCors(errorResponse(message, 500, 'SYNC_PRO_FAILED'));
  }
});
