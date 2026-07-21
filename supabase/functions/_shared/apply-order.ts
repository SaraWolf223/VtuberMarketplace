import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export async function syncConnectAccountFlags(
  admin: SupabaseClient,
  account: Stripe.Account
): Promise<void> {
  if (!account.id) return;

  await admin
    .from('profiles')
    .update({
      connect_charges_enabled: account.charges_enabled ?? false,
      connect_payouts_enabled: account.payouts_enabled ?? false,
      connect_details_submitted: account.details_submitted ?? false,
    })
    .eq('stripe_connect_account_id', account.id);
}

export async function markOrderPaidFromCheckout(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const orderId = session.metadata?.order_id;
  if (!orderId || session.metadata?.type !== 'order') {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_id, seller_id, listing_id, promo_code_id, discount_cents_applied')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.status !== 'pending_payment') {
    return;
  }

  const { count: addonCount } = await admin
    .from('order_addons')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);

  const hasAddons = (addonCount ?? 0) > 0;
  const nextStatus = hasAddons ? 'awaiting_fulfillment' : 'fulfilled';
  const now = new Date().toISOString();

  await admin
    .from('orders')
    .update({
      status: nextStatus,
      paid_at: now,
      fulfilled_at: hasAddons ? null : now,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      updated_at: now,
    })
    .eq('id', orderId)
    .eq('status', 'pending_payment');

  if (order.promo_code_id && order.discount_cents_applied > 0) {
    const { data: existing } = await admin
      .from('promo_redemptions')
      .select('id')
      .eq('promo_code_id', order.promo_code_id)
      .eq('user_id', order.buyer_id)
      .maybeSingle();

    if (!existing) {
      await admin.from('promo_redemptions').insert({
        promo_code_id: order.promo_code_id,
        user_id: order.buyer_id,
        order_id: orderId,
        discount_cents_applied: order.discount_cents_applied,
      });

      const { data: promoRow } = await admin
        .from('promo_codes')
        .select('redemption_count, max_redemptions')
        .eq('id', order.promo_code_id)
        .maybeSingle();

      if (
        promoRow &&
        (promoRow.max_redemptions == null ||
          promoRow.redemption_count < promoRow.max_redemptions)
      ) {
        await admin
          .from('promo_codes')
          .update({ redemption_count: promoRow.redemption_count + 1 })
          .eq('id', order.promo_code_id);
      }
    }
  }

  await admin.from('notifications').insert({
    user_id: order.buyer_id,
    kind: 'order_paid',
    title: 'Purchase complete',
    body: 'Your order is paid. Check your Library for download access.',
    listing_id: order.listing_id,
  });
}

export async function markOrderRefunded(
  admin: SupabaseClient,
  paymentIntentId: string
): Promise<void> {
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_id, listing_id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (!order || order.status === 'refunded') {
    return;
  }

  const now = new Date().toISOString();
  await admin
    .from('orders')
    .update({ status: 'refunded', refunded_at: now, updated_at: now })
    .eq('id', order.id);

  await admin.from('notifications').insert({
    user_id: order.buyer_id,
    kind: 'order_refunded',
    title: 'Order refunded',
    body: 'Your purchase was refunded.',
    listing_id: order.listing_id,
  });
}
