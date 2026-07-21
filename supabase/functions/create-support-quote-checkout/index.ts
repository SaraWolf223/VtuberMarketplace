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

  let body: { quote_id?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(errorResponse('Invalid JSON', 400, 'INVALID_JSON'));
  }

  if (!body.quote_id) {
    return withCors(errorResponse('quote_id required', 400, 'VALIDATION'));
  }

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: quote } = await admin
      .from('support_work_quotes')
      .select('*')
      .eq('id', body.quote_id)
      .single();

    if (!quote) {
      return withCors(errorResponse('Quote not found', 404, 'NOT_FOUND'));
    }
    if (quote.buyer_id !== auth.user.id) {
      return withCors(errorResponse('Not the buyer', 403, 'FORBIDDEN'));
    }
    if (quote.status !== 'accepted') {
      return withCors(errorResponse('Quote must be accepted first', 400, 'NOT_ACCEPTED'));
    }
    if (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now()) {
      await admin.from('support_work_quotes').update({ status: 'expired' }).eq('id', quote.id);
      return withCors(errorResponse('Quote expired', 400, 'EXPIRED'));
    }

    const { data: seller } = await admin
      .from('profiles')
      .select('stripe_connect_account_id, connect_charges_enabled')
      .eq('id', quote.seller_id)
      .single();

    if (!seller?.stripe_connect_account_id || !seller.connect_charges_enabled) {
      return withCors(errorResponse('Seller cannot accept payment', 400, 'SELLER_NOT_READY'));
    }

    const { data: feeBps } = await admin.rpc('current_platform_fee_bps', {
      p_seller_id: quote.seller_id,
    });
    const feeCents = Math.round((quote.amount_cents * Number(feeBps ?? 1000)) / 10000);

    const { data: buyer } = await admin
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', auth.user.id)
      .single();

    let customerId = buyer?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: buyer?.email ?? auth.user.email ?? undefined,
        metadata: { user_id: auth.user.id },
      });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', auth.user.id);
    }

    const returnBase =
      Deno.env.get('STRIPE_CHECKOUT_RETURN_URL') ?? 'vtubermarketplace://library/subscriptions';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: quote.amount_cents,
            product_data: {
              name: quote.title,
              description: quote.description ?? 'Support work quote',
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: { destination: seller.stripe_connect_account_id },
        metadata: {
          type: 'support_work_quote',
          quote_id: quote.id,
          buyer_id: quote.buyer_id,
          seller_id: quote.seller_id,
        },
      },
      success_url: `${returnBase}?quote=success&id=${quote.id}`,
      cancel_url: `${returnBase}?quote=cancel`,
      metadata: {
        type: 'support_work_quote',
        quote_id: quote.id,
        buyer_id: quote.buyer_id,
        seller_id: quote.seller_id,
      },
    });

    await admin
      .from('support_work_quotes')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', quote.id);

    return withCors(okResponse({ checkout_url: session.url, quote_id: quote.id }));
  } catch (e) {
    console.error('create-support-quote-checkout', e);
    return withCors(errorResponse('Server error', 500, 'SERVER'));
  }
});
