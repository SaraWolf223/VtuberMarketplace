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

  let body: { listing_id?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(errorResponse('Invalid JSON', 400, 'INVALID_JSON'));
  }

  if (!body.listing_id) {
    return withCors(errorResponse('listing_id required', 400, 'VALIDATION'));
  }

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: listing } = await admin
      .from('listings')
      .select('id, seller_id, title, asset_type, category')
      .eq('id', body.listing_id)
      .single();

    if (!listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }
    if (listing.seller_id === auth.user.id) {
      return withCors(errorResponse('Cannot subscribe to own listing', 400, 'OWN_LISTING'));
    }

    const { data: plan } = await admin
      .from('listing_support_plans')
      .select('*')
      .eq('listing_id', body.listing_id)
      .eq('active', true)
      .maybeSingle();

    if (!plan?.stripe_price_id) {
      return withCors(errorResponse('No active support plan', 400, 'NO_ACTIVE_PLAN'));
    }

    const { data: order } = await admin
      .from('orders')
      .select('id')
      .eq('listing_id', body.listing_id)
      .eq('buyer_id', auth.user.id)
      .eq('status', 'fulfilled')
      .order('fulfilled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order) {
      return withCors(errorResponse('Purchase required first', 400, 'NO_FULFILLED_ORDER'));
    }

    const { data: existingSub } = await admin
      .from('listing_support_subscriptions')
      .select('id')
      .eq('listing_id', body.listing_id)
      .eq('buyer_id', auth.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingSub) {
      return withCors(errorResponse('Already subscribed', 400, 'ALREADY_SUBSCRIBED'));
    }

    const { data: seller } = await admin
      .from('profiles')
      .select('stripe_connect_account_id, connect_charges_enabled')
      .eq('id', listing.seller_id)
      .single();

    if (!seller?.stripe_connect_account_id || !seller.connect_charges_enabled) {
      return withCors(errorResponse('Seller cannot accept subscriptions', 400, 'SELLER_NOT_READY'));
    }

    const { data: feeBps } = await admin.rpc('current_platform_fee_bps', {
      p_seller_id: listing.seller_id,
    });
    const feePercent = Math.min(100, Math.max(0, Number(feeBps ?? 1000) / 100));

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

    const { data: pendingRow, error: insertErr } = await admin
      .from('listing_support_subscriptions')
      .insert({
        listing_id: body.listing_id,
        buyer_id: auth.user.id,
        seller_id: listing.seller_id,
        order_id: order.id,
        plan_id: plan.id,
        stripe_customer_id: customerId,
        status: 'incomplete',
      })
      .select('id')
      .single();

    if (insertErr || !pendingRow) {
      return withCors(errorResponse(insertErr?.message ?? 'Insert failed', 500, 'DB'));
    }

    const returnBase =
      Deno.env.get('STRIPE_CHECKOUT_RETURN_URL') ?? 'vtubermarketplace://library/subscriptions';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${returnBase}?support=success&sub=${pendingRow.id}`,
      cancel_url: `${returnBase}?support=cancel`,
      client_reference_id: auth.user.id,
      metadata: {
        type: 'listing_support_subscription',
        subscription_row_id: pendingRow.id,
        listing_id: body.listing_id,
        buyer_id: auth.user.id,
        seller_id: listing.seller_id,
      },
      subscription_data: {
        application_fee_percent: feePercent,
        transfer_data: { destination: seller.stripe_connect_account_id },
        metadata: {
          type: 'listing_support_subscription',
          subscription_row_id: pendingRow.id,
          listing_id: body.listing_id,
          buyer_id: auth.user.id,
          seller_id: listing.seller_id,
        },
      },
    });

    return withCors(
      okResponse({ checkout_url: session.url, subscription_id: pendingRow.id })
    );
  } catch (e) {
    console.error('create-support-subscription-checkout', e);
    return withCors(errorResponse('Server error', 500, 'SERVER'));
  }
});
