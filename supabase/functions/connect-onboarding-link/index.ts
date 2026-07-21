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

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_connect_account_id, connect_details_submitted')
      .eq('id', auth.user.id)
      .single();

    if (!profile?.stripe_connect_account_id) {
      return withCors(
        errorResponse('Connect account missing — create one first', 409, 'CONNECT_ACCOUNT_MISSING')
      );
    }

    const returnBase =
      Deno.env.get('STRIPE_CONNECT_RETURN_URL') ??
      Deno.env.get('STRIPE_CHECKOUT_RETURN_URL') ??
      'vtubermarketplace://settings/seller';

    const linkType = profile.connect_details_submitted ? 'account_update' : 'account_onboarding';

    const link = await stripe.accountLinks.create({
      account: profile.stripe_connect_account_id,
      type: linkType,
      refresh_url: `${returnBase}?connect=refresh`,
      return_url: `${returnBase}?connect=return`,
    });

    return withCors(okResponse({ url: link.url }));
  } catch (e) {
    console.error('connect-onboarding-link', e);
    const message = e instanceof Error ? e.message : 'Server error';
    if (message.includes('STRIPE_SECRET_KEY')) {
      return withCors(errorResponse('Payments not configured', 503, 'STRIPE_CONFIG'));
    }
    return withCors(errorResponse('Server error', 500, 'SERVER'));
  }
});
