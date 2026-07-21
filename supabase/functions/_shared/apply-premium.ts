import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// TODO(VtuberMarketplace): superseded by Pro Seller webhook sync in stripe-webhook.
// See docs/10-Monetization_System.md §4.
import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { getStripe } from './stripe.ts';
import {
  currentCreditPeriodStart,
  ensureMonthlyCreditsRow,
  PREMIUM_CREDITS_PER_MONTH,
} from './premium-credits.ts';

function periodStartFromInvoice(invoice: Stripe.Invoice): string {
  const start = invoice.period_start
    ? new Date(invoice.period_start * 1000)
    : new Date();
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function isPremiumStatusActive(
  status: string,
  currentPeriodEnd: Date,
  now: Date = new Date()
): boolean {
  if (currentPeriodEnd.getTime() <= now.getTime()) return false;
  if (status === 'active' || status === 'trialing') return true;
  if (status === 'past_due') return true;
  if (status === 'canceled' || status === 'unpaid') return currentPeriodEnd > now;
  return false;
}

export async function syncPremiumFromSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  fallbackUserId?: string
): Promise<void> {
  const userId = subscription.metadata?.user_id ?? fallbackUserId;
  if (!userId) {
    console.warn('subscription missing user_id metadata', subscription.id);
    return;
  }

  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);
  const active = isPremiumStatusActive(subscription.status, periodEnd);

  await admin.from('premium_subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      status: subscription.status,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );

  await admin
    .from('profiles')
    .update({
      is_premium: active,
      premium_until: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (active) {
    await ensureMonthlyCreditsRow(admin, userId, currentCreditPeriodStart());
  }
}

/** Pull Stripe subscriptions for this customer and sync Premium state (post-checkout + repair). */
export async function syncPremiumForStripeCustomer(
  admin: SupabaseClient,
  userId: string,
  customerId: string
): Promise<{ premium_active: boolean; premium_until: string | null }> {
  const stripe = getStripe();
  let premiumActive = false;
  let premiumUntil: string | null = null;

  const statuses = ['active', 'trialing', 'past_due', 'canceled'] as const;
  for (const status of statuses) {
    const { data } = await stripe.subscriptions.list({
      customer: customerId,
      status,
      limit: 20,
    });

    for (const sub of data) {
      const metaUser = sub.metadata?.user_id;
      if (metaUser && metaUser !== userId) continue;

      if (!sub.metadata?.user_id || sub.metadata?.type !== 'premium_seller') {
        await stripe.subscriptions.update(sub.id, {
          metadata: {
            ...sub.metadata,
            type: 'premium_seller',
            user_id: userId,
          },
        });
      }

      const refreshed = await stripe.subscriptions.retrieve(sub.id);
      await syncPremiumFromSubscription(admin, refreshed, userId);

      const end = new Date(refreshed.current_period_end * 1000);
      if (isPremiumStatusActive(refreshed.status, end)) {
        premiumActive = true;
        premiumUntil = end.toISOString();
      }
    }
  }

  return { premium_active: premiumActive, premium_until: premiumUntil };
}

export async function syncPremiumFromCheckoutSession(
  admin: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<{ premium_active: boolean; premium_until: string | null }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  if (session.mode !== 'subscription') {
    return { premium_active: false, premium_until: null };
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { premium_active: false, premium_until: null };
  }

  const sessionOwnerId =
    session.client_reference_id ?? session.metadata?.user_id ?? null;

  if (!sessionOwnerId || sessionOwnerId !== userId) {
    return { premium_active: false, premium_until: null };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (session.customer && profile?.stripe_customer_id) {
    const sessionCustomer =
      typeof session.customer === 'string' ? session.customer : session.customer.id;
    if (sessionCustomer !== profile.stripe_customer_id) {
      return { premium_active: false, premium_until: null };
    }
  }

  const subRef = session.subscription;
  const subId =
    typeof subRef === 'string' ? subRef : subRef && typeof subRef === 'object' ? subRef.id : null;

  if (!subId) {
    return { premium_active: false, premium_until: null };
  }

  let sub = await stripe.subscriptions.retrieve(subId);

  if (sub.metadata?.user_id && sub.metadata.user_id !== userId) {
    return { premium_active: false, premium_until: null };
  }

  if (!sub.metadata?.user_id || sub.metadata?.type !== 'premium_seller') {
    await stripe.subscriptions.update(subId, {
      metadata: {
        ...sub.metadata,
        type: 'premium_seller',
        user_id: userId,
      },
    });
    sub = await stripe.subscriptions.retrieve(subId);
  }

  await syncPremiumFromSubscription(admin, sub, userId);
  const end = new Date(sub.current_period_end * 1000);
  const premium_active = isPremiumStatusActive(sub.status, end);
  return {
    premium_active,
    premium_until: premium_active ? end.toISOString() : null,
  };
}

export async function resetCreditsFromInvoice(
  admin: SupabaseClient,
  invoice: Stripe.Invoice
): Promise<void> {
  if (!invoice.subscription) return;

  const stripe = getStripe();
  const subId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subId);
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  const periodStart = periodStartFromInvoice(invoice);

  await admin.from('premium_boost_credits').upsert(
    {
      user_id: userId,
      period_start: periodStart,
      credits_total: PREMIUM_CREDITS_PER_MONTH,
      credits_used: 0,
    },
    { onConflict: 'user_id,period_start' }
  );
}
