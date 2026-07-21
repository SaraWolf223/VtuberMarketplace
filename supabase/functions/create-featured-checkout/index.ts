import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { grossUpForStripeFees } from '../_shared/stripe-processing-fee.ts';

const DEFAULT_FEATURED_CENTS = 500;

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

  let body: { listing_id?: string; use_credit?: boolean };
  try {
    body = (await req.json()) as { listing_id?: string; use_credit?: boolean };
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  if (!body.listing_id) {
    return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
  }

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: listing } = await admin
      .from('listings')
      .select('id, seller_id, status, title')
      .eq('id', body.listing_id)
      .single();

    if (!listing) return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    if (listing.seller_id !== auth.user.id) {
      return withCors(errorResponse('Not your listing', 403, 'FORBIDDEN'));
    }
    if (listing.status !== 'active') {
      return withCors(errorResponse('Only active listings can be featured', 400, 'INACTIVE'));
    }

    // Prefer Pro Seller monthly credit when available (unless forced paid).
    if (body.use_credit !== false) {
      const periodStart = new Date();
      const y = periodStart.getUTCFullYear();
      const m = String(periodStart.getUTCMonth() + 1).padStart(2, '0');
      const { data: credit } = await admin
        .from('featured_listing_credits')
        .select('*')
        .eq('user_id', auth.user.id)
        .eq('period_start', `${y}-${m}-01`)
        .maybeSingle();

      if (credit && credit.credits_used < credit.credits_total) {
        return withCors(
          okResponse({
            use_credit: true,
            credits_remaining: credit.credits_total - credit.credits_used,
            credits_total: credit.credits_total,
          })
        );
      }
    }

    const { data: priceCfg } = await admin
      .from('public_app_config')
      .select('value')
      .eq('key', 'featured_placement_price_cents')
      .maybeSingle();
    const baseCents =
      typeof priceCfg?.value === 'number'
        ? priceCfg.value
        : Number(priceCfg?.value ?? DEFAULT_FEATURED_CENTS) || DEFAULT_FEATURED_CENTS;

    const { data: profile } = await admin
      .from('profiles')
      .select('email, stripe_customer_id')
      .eq('id', auth.user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email,
        metadata: { user_id: auth.user.id },
      });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', auth.user.id);
    }

    const charged = grossUpForStripeFees(baseCents);
    const returnBase =
      Deno.env.get('STRIPE_CHECKOUT_RETURN_URL') ?? 'vtubermarketplace://my-listings';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Featured listing: ${listing.title}`,
              description: 'Featured placement on the VTuber Marketplace catalog',
            },
            unit_amount: charged.baseCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Card processing fee' },
            unit_amount: charged.processingFeeCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${returnBase}?featured=success&session_id={CHECKOUT_SESSION_ID}&listing_id=${listing.id}`,
      cancel_url: `${returnBase}?featured=cancel`,
      metadata: {
        user_id: auth.user.id,
        listing_id: listing.id,
        type: 'featured_listing',
        amount_cents: String(baseCents),
      },
      payment_intent_data: {
        metadata: {
          user_id: auth.user.id,
          listing_id: listing.id,
          type: 'featured_listing',
        },
      },
    });

    return withCors(okResponse({ checkout_url: session.url, session_id: session.id }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Featured checkout failed';
    return withCors(errorResponse(message, 500, 'CHECKOUT_FAILED'));
  }
});
