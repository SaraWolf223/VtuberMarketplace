import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';

type CheckoutBody = {
  listing_id?: string;
  addon_option_ids?: string[];
  promo_code?: string;
  license_acknowledged?: boolean;
};

type PromoValidation = {
  promo_code_id: string;
  discount_cents: number;
};

async function validatePromoForCheckout(
  admin: ReturnType<typeof createSupabaseAdmin>,
  code: string,
  listingId: string,
  sellerId: string,
  buyerId: string,
  basePriceCents: number
): Promise<PromoValidation | { error: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9_-]{4,32}$/.test(normalized)) {
    return { error: 'INVALID_CODE' };
  }

  const { data: promo } = await admin
    .from('promo_codes')
    .select('*')
    .ilike('code', normalized)
    .maybeSingle();

  if (!promo?.active) {
    return { error: 'INVALID_CODE' };
  }

  if (promo.type !== 'percent_off' && promo.type !== 'flat_off_cents') {
    return { error: 'INVALID_CODE' };
  }

  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) {
    return { error: 'INVALID_CODE' };
  }

  if (promo.max_redemptions != null && promo.redemption_count >= promo.max_redemptions) {
    return { error: 'INVALID_CODE' };
  }

  if (promo.scope === 'seller' && promo.seller_id !== sellerId) {
    return { error: 'NOT_APPLICABLE' };
  }

  const { data: prior } = await admin
    .from('promo_redemptions')
    .select('id')
    .eq('promo_code_id', promo.id)
    .eq('user_id', buyerId)
    .maybeSingle();

  if (prior) {
    return { error: 'ALREADY_REDEEMED' };
  }

  let discountCents = 0;
  if (promo.type === 'percent_off') {
    discountCents = Math.floor((basePriceCents * promo.value) / 100);
  } else {
    discountCents = Math.min(promo.value, basePriceCents);
  }

  return { promo_code_id: promo.id, discount_cents: discountCents };
}

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

  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return withCors(errorResponse('Invalid JSON', 400, 'INVALID_JSON'));
  }

  if (!body.listing_id) {
    return withCors(errorResponse('listing_id required', 400, 'VALIDATION'));
  }

  if (body.license_acknowledged !== true) {
    return withCors(
      errorResponse('You must accept the listing license', 400, 'LICENSE_NOT_ACKNOWLEDGED')
    );
  }

  const addonIds = Array.isArray(body.addon_option_ids)
    ? [...new Set(body.addon_option_ids.filter(Boolean))]
    : [];

  try {
    const admin = createSupabaseAdmin();
    const stripe = getStripe();

    const { data: buyer } = await admin
      .from('profiles')
      .select('id, banned_at, email, stripe_customer_id')
      .eq('id', auth.user.id)
      .single();

    if (!buyer || buyer.banned_at) {
      return withCors(errorResponse('Account not eligible', 403, 'BANNED'));
    }

    const { data: listing } = await admin
      .from('listings')
      .select(
        'id, seller_id, title, status, license_type, license_text, download_url'
      )
      .eq('id', body.listing_id)
      .single();

    if (!listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    if (listing.seller_id === auth.user.id) {
      return withCors(errorResponse('Cannot buy your own listing', 400, 'OWN_LISTING'));
    }

    if (listing.status !== 'active') {
      return withCors(errorResponse('Listing is not available', 400, 'LISTING_NOT_PURCHASABLE'));
    }

    if (!listing.license_text?.trim()) {
      return withCors(errorResponse('Listing license missing', 400, 'LISTING_NOT_PURCHASABLE'));
    }

    if (!listing.download_url?.trim()) {
      return withCors(errorResponse('Listing download link missing', 400, 'LISTING_NOT_PURCHASABLE'));
    }

    const { data: seller } = await admin
      .from('profiles')
      .select(
        'stripe_connect_account_id, connect_charges_enabled, connect_payouts_enabled, phone_verified_at'
      )
      .eq('id', listing.seller_id)
      .single();

    if (
      !seller?.stripe_connect_account_id ||
      !seller.connect_charges_enabled ||
      !seller.connect_payouts_enabled ||
      !seller.phone_verified_at
    ) {
      return withCors(
        errorResponse('Seller cannot accept payments right now', 400, 'SELLER_NOT_PAYOUT_READY')
      );
    }

    const { data: basePriceCents, error: priceErr } = await admin.rpc(
      'listing_effective_price_cents',
      { p_listing_id: listing.id }
    );

    let baseCents: number;
    if (priceErr || basePriceCents == null) {
      const { data: listingPrice } = await admin
        .from('listings')
        .select('price')
        .eq('id', listing.id)
        .single();
      baseCents = Math.round(Number(listingPrice?.price ?? 0) * 100);
    } else {
      baseCents = Number(basePriceCents);
    }

    if (baseCents <= 0) {
      return withCors(errorResponse('Invalid listing price', 400, 'VALIDATION'));
    }
    let addonTotalCents = 0;
    const addonSnapshots: {
      addon_option_id: string;
      kind: string;
      name_snapshot: string;
      fee_cents_snapshot: number;
    }[] = [];

    if (addonIds.length > 0) {
      const { data: addons } = await admin
        .from('listing_addon_options')
        .select('id, listing_id, kind, name, extra_fee_cents, active')
        .in('id', addonIds);

      if (!addons || addons.length !== addonIds.length) {
        return withCors(errorResponse('Invalid add-on selection', 400, 'VALIDATION'));
      }

      for (const addon of addons) {
        if (addon.listing_id !== listing.id || !addon.active) {
          return withCors(errorResponse('Add-on no longer available', 400, 'VALIDATION'));
        }
        addonTotalCents += addon.extra_fee_cents;
        addonSnapshots.push({
          addon_option_id: addon.id,
          kind: addon.kind,
          name_snapshot: addon.name,
          fee_cents_snapshot: addon.extra_fee_cents,
        });
      }
    }

    const totalCents = baseCents + addonTotalCents;
    let discountCents = 0;
    let promoCodeId: string | null = null;

    if (body.promo_code?.trim()) {
      const promoResult = await validatePromoForCheckout(
        admin,
        body.promo_code,
        listing.id,
        listing.seller_id,
        auth.user.id,
        baseCents
      );
      if ('error' in promoResult) {
        const code =
          promoResult.error === 'NOT_APPLICABLE'
            ? 'NOT_APPLICABLE'
            : promoResult.error === 'ALREADY_REDEEMED'
              ? 'ALREADY_REDEEMED'
              : 'INVALID_CODE';
        return withCors(errorResponse('Promo code is not valid', 400, code));
      }
      discountCents = promoResult.discount_cents;
      promoCodeId = promoResult.promo_code_id;
    }

    const chargeCents = totalCents - discountCents;
    if (chargeCents <= 0) {
      return withCors(errorResponse('Order total must be greater than zero', 400, 'VALIDATION'));
    }

    const { data: feeBps } = await admin.rpc('current_platform_fee_bps', {
      p_seller_id: listing.seller_id,
    });
    const platformFeeCents = Math.round((chargeCents * Number(feeBps ?? 1000)) / 10000);

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .insert({
        listing_id: listing.id,
        buyer_id: auth.user.id,
        seller_id: listing.seller_id,
        license_type: listing.license_type,
        license_snapshot: listing.license_text.trim(),
        base_price_cents: baseCents,
        addon_total_cents: addonTotalCents,
        total_cents: totalCents,
        platform_fee_cents: platformFeeCents,
        fee_bps_applied: Number(feeBps ?? 1000),
        promo_code_id: promoCodeId,
        discount_cents_applied: discountCents,
        status: 'pending_payment',
      })
      .select('id')
      .single();

    if (orderErr || !order) {
      return withCors(errorResponse(orderErr?.message ?? 'Could not create order', 500, 'DB'));
    }

    if (addonSnapshots.length > 0) {
      const { error: addonErr } = await admin.from('order_addons').insert(
        addonSnapshots.map((row) => ({
          order_id: order.id,
          ...row,
        }))
      );
      if (addonErr) {
        await admin.from('orders').delete().eq('id', order.id);
        return withCors(errorResponse(addonErr.message, 500, 'DB'));
      }
    }

    let customerId = buyer.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: buyer.email ?? auth.user.email ?? undefined,
        metadata: { user_id: auth.user.id },
      });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', auth.user.id);
    }

    const returnBase =
      Deno.env.get('STRIPE_CHECKOUT_RETURN_URL') ?? 'vtubermarketplace://library';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: chargeCents,
            product_data: {
              name: listing.title,
              description: 'Digital VTuber asset — seller-hosted download',
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: seller.stripe_connect_account_id },
        metadata: {
          type: 'order',
          order_id: order.id,
          listing_id: listing.id,
          buyer_id: auth.user.id,
          seller_id: listing.seller_id,
        },
      },
      success_url: `${returnBase}?order=success&id=${order.id}`,
      cancel_url: `${returnBase}?order=cancel&id=${order.id}`,
      metadata: {
        type: 'order',
        order_id: order.id,
        listing_id: listing.id,
        buyer_id: auth.user.id,
        seller_id: listing.seller_id,
      },
    });

    await admin
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    if (!session.url) {
      return withCors(errorResponse('Could not start checkout', 500, 'STRIPE_ERROR'));
    }

    return withCors(okResponse({ checkout_url: session.url, order_id: order.id }));
  } catch (e) {
    console.error('create-order-checkout', e);
    const message = e instanceof Error ? e.message : 'Server error';
    if (message.includes('STRIPE_SECRET_KEY')) {
      return withCors(errorResponse('Payments not configured', 503, 'STRIPE_CONFIG'));
    }
    return withCors(errorResponse('Server error', 500, 'SERVER'));
  }
});
