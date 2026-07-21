import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { syncProSellerForStripeCustomer } from '../_shared/apply-pro-seller.ts';
import { grossUpForStripeFees } from '../_shared/stripe-processing-fee.ts';

const PRO_SELLER_BASE_CENTS = 500;

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

  const priceId =
    Deno.env.get('STRIPE_PRICE_PRO_SELLER') ?? Deno.env.get('STRIPE_PRICE_PREMIUM');
  if (!priceId) {
    return withCors(
      errorResponse('Pro Seller price not configured (STRIPE_PRICE_PRO_SELLER)', 503, 'STRIPE_PRICE')
    );
  }

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, stripe_customer_id, is_pro_seller, pro_seller_until, is_premium, premium_until')
      .eq('id', auth.user.id)
      .single();

    if (!profile) {
      return withCors(errorResponse('Profile not found', 404, 'PROFILE_NOT_FOUND'));
    }

    const until = profile.pro_seller_until ?? profile.premium_until;
    if ((profile.is_pro_seller || profile.is_premium) && until && new Date(until).getTime() > Date.now()) {
      return withCors(errorResponse('You already have Pro Seller', 400, 'ALREADY_PRO'));
    }

    let customerId = profile.stripe_customer_id as string | null;
    if (customerId) {
      const synced = await syncProSellerForStripeCustomer(admin, auth.user.id, customerId);
      if (synced.pro_seller_active) {
        return withCors(errorResponse('You already have Pro Seller', 400, 'ALREADY_PRO'));
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { user_id: auth.user.id },
      });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', auth.user.id);
    }

    const returnBase =
      Deno.env.get('STRIPE_CHECKOUT_RETURN_URL') ?? 'vtubermarketplace://settings/premium';
    const fee = grossUpForStripeFees(PRO_SELLER_BASE_CENTS);

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
              description: 'Covers Stripe card processing (not platform profit).',
            },
            unit_amount: fee.processingFeeCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${returnBase}?pro_seller=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnBase}?pro_seller=cancel`,
      subscription_data: {
        metadata: { user_id: auth.user.id, type: 'pro_seller' },
      },
      metadata: { user_id: auth.user.id, type: 'pro_seller' },
    });

    return withCors(
      okResponse({ checkout_url: session.url, session_id: session.id })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Checkout failed';
    return withCors(errorResponse(message, 500, 'CHECKOUT_FAILED'));
  }
});
