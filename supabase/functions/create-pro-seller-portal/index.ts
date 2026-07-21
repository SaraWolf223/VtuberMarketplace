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
      .select('stripe_customer_id')
      .eq('id', auth.user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return withCors(
        errorResponse('No billing account. Subscribe to Pro Seller first.', 400, 'NO_CUSTOMER')
      );
    }

    const returnUrl =
      Deno.env.get('STRIPE_PORTAL_RETURN_URL') ?? 'vtubermarketplace://settings/premium';

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id as string,
      return_url: returnUrl,
    });

    return withCors(okResponse({ url: session.url }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not open billing portal';
    return withCors(errorResponse(message, 500, 'PORTAL_FAILED'));
  }
});
