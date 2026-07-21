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
      .select('id, banned_at, stripe_connect_account_id')
      .eq('id', auth.user.id)
      .single();

    if (!profile || profile.banned_at) {
      return withCors(errorResponse('Account not eligible', 403, 'BANNED'));
    }

    if (profile.stripe_connect_account_id) {
      return withCors(
        okResponse({ stripe_account_id: profile.stripe_connect_account_id })
      );
    }

    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { user_id: auth.user.id },
    });

    await admin
      .from('profiles')
      .update({ stripe_connect_account_id: account.id })
      .eq('id', auth.user.id);

    return withCors(okResponse({ stripe_account_id: account.id }));
  } catch (e) {
    console.error('create-connect-account', e);
    const message = e instanceof Error ? e.message : 'Server error';
    if (message.includes('STRIPE_SECRET_KEY')) {
      return withCors(errorResponse('Payments not configured', 503, 'STRIPE_CONFIG'));
    }
    return withCors(errorResponse('Server error', 500, 'SERVER'));
  }
});
