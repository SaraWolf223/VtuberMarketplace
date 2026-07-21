import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

function mapStatus(status: Stripe.Subscription.Status): string {
  if (status === 'active' || status === 'trialing') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'unpaid') return 'unpaid';
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled';
  return 'incomplete';
}

export async function syncListingSupportSubscription(
  admin: SupabaseClient,
  sub: Stripe.Subscription,
  rowIdHint?: string | null
): Promise<void> {
  const rowId = rowIdHint ?? sub.metadata?.subscription_row_id ?? null;
  if (!rowId && sub.metadata?.type !== 'listing_support_subscription') {
    return;
  }

  const status = mapStatus(sub.status);
  const periodStart = sub.current_period_start
    ? new Date(sub.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const patch: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString(),
  };
  if (status === 'canceled') {
    patch.canceled_at = new Date().toISOString();
  }

  if (rowId) {
    await admin.from('listing_support_subscriptions').update(patch).eq('id', rowId);
    return;
  }

  await admin
    .from('listing_support_subscriptions')
    .update(patch)
    .eq('stripe_subscription_id', sub.id);
}

export async function markSupportQuotePaid(
  admin: SupabaseClient,
  quoteId: string,
  paymentIntentId: string | null
): Promise<void> {
  await admin
    .from('support_work_quotes')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)
    .in('status', ['accepted', 'pending_buyer']);
}
