// TODO(VtuberMarketplace): superseded by create-pro-seller-checkout.
// See docs/10-Monetization_System.md §4 — legacy Premium subscription; keep deployed until client migrates.
import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { syncPremiumForStripeCustomer } from '../_shared/apply-premium.ts';
import { grossUpForStripeFees } from '../_shared/stripe-processing-fee.ts';

const PREMIUM_BASE_CENTS = 500;

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

  const priceId = Deno.env.get('STRIPE_PRICE_PREMIUM');
  if (!priceId) {
    return withCors(
      errorResponse('Premium price not configured', 503, 'STRIPE_PRICE_PREMIUM')
    );
  }

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, stripe_customer_id, is_premium, premium_until')
      .eq('id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return withCors(errorResponse('Profile not found', 404, 'PROFILE_NOT_FOUND'));
    }

    if (
      profile.is_premium &&
      profile.premium_until &&
      new Date(profile.premium_until).getTime() > Date.now()
    ) {
      return withCors(errorResponse('You already have Premium', 400, 'ALREADY_PREMIUM'));
    }

    const { data: activeSub } = await admin
      .from('premium_subscriptions')
      .select('id')
      .eq('user_id', auth.user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle();

    if (activeSub) {
      return withCors(errorResponse('You already have Premium', 400, 'ALREADY_PREMIUM'));
    }

    let customerId = profile.stripe_customer_id as string | null;

    if (customerId) {
      const synced = await syncPremiumForStripeCustomer(admin, auth.user.id, customerId);
      if (synced.premium_active) {
        return withCors(errorResponse('You already have Premium', 400, 'ALREADY_PREMIUM'));
      }
    }

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

    // Drop stale incomplete subscriptions so repeated taps do not pile up.
    const incomplete = await stripe.subscriptions.list({
      customer: customerId,
      status: 'incomplete',
      limit: 20,
    });
    for (const sub of incomplete.data) {
      try {
        await stripe.subscriptions.cancel(sub.id);
      } catch {
        /* best effort */
      }
    }

    const returnBase =
      Deno.env.get('STRIPE_CHECKOUT_RETURN_URL') ?? 'localmarketplace://settings/premium';

    const premiumCharge = grossUpForStripeFees(PREMIUM_BASE_CENTS);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        { price: priceId, quantity: 1 },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Card processing fee',
              description:
                'Covers Stripe card processing on your subscription payment (not kept as platform profit).',
            },
            unit_amount: premiumCharge.processing_fee_cents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${returnBase}?checkout=success`,
      cancel_url: `${returnBase}?checkout=cancel`,
      client_reference_id: auth.user.id,
      subscription_data: {
        metadata: {
          type: 'premium_seller',
          user_id: auth.user.id,
        },
      },
      metadata: {
        type: 'premium_seller',
        user_id: auth.user.id,
      },
    });

    if (!session.url) {
      return withCors(errorResponse('Could not start checkout', 500, 'STRIPE_ERROR'));
    }

    return withCors(
      okResponse({
        checkout_url: session.url,
        session_id: session.id,
        base_amount_cents: premiumCharge.base_cents,
        processing_fee_cents: premiumCharge.processing_fee_cents,
        amount_cents: premiumCharge.total_cents,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Premium checkout failed';
    if (message.includes('STRIPE_SECRET_KEY')) {
      return withCors(errorResponse('Payments not configured', 503, 'STRIPE_CONFIG'));
    }
    return withCors(errorResponse(message, 500, 'STRIPE_ERROR'));
  }
});
