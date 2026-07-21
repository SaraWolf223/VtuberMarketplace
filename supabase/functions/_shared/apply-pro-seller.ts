import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { getStripe } from './stripe.ts';

const PRO_SELLER_FEATURED_CREDITS = 4;

function isProStatusActive(status: string, periodEnd: Date, now = new Date()): boolean {
  if (periodEnd.getTime() <= now.getTime()) return false;
  if (status === 'active' || status === 'trialing' || status === 'past_due') return true;
  if (status === 'canceled' || status === 'unpaid') return periodEnd > now;
  return false;
}

async function ensureFeaturedCredits(
  admin: SupabaseClient,
  userId: string,
  periodStartIso: string
): Promise<void> {
  const periodStart = periodStartIso.slice(0, 10);
  const { data: existing } = await admin
    .from('featured_listing_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .maybeSingle();
  if (existing) return;
  await admin.from('featured_listing_credits').insert({
    user_id: userId,
    period_start: periodStart,
    credits_total: PRO_SELLER_FEATURED_CREDITS,
    credits_used: 0,
  });
}

export async function syncProSellerFromSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  fallbackUserId?: string
): Promise<void> {
  const userId = subscription.metadata?.user_id ?? fallbackUserId;
  if (!userId) return;

  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);
  const active = isProStatusActive(subscription.status, periodEnd);

  await admin.from('pro_seller_subscriptions').upsert(
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
      is_pro_seller: active,
      pro_seller_until: periodEnd.toISOString(),
      // Keep legacy Premium flags in sync during transition.
      is_premium: active,
      premium_until: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (active) {
    const y = periodStart.getUTCFullYear();
    const m = String(periodStart.getUTCMonth() + 1).padStart(2, '0');
    await ensureFeaturedCredits(admin, userId, `${y}-${m}-01`);
  }
}

export async function syncProSellerForStripeCustomer(
  admin: SupabaseClient,
  userId: string,
  customerId: string
): Promise<{ pro_seller_active: boolean; pro_seller_until: string | null }> {
  const stripe = getStripe();
  let proActive = false;
  let proUntil: string | null = null;

  for (const status of ['active', 'trialing', 'past_due', 'canceled'] as const) {
    const { data } = await stripe.subscriptions.list({
      customer: customerId,
      status,
      limit: 20,
    });
    for (const sub of data) {
      const metaUser = sub.metadata?.user_id;
      if (metaUser && metaUser !== userId) continue;
      const kind = sub.metadata?.type;
      if (kind && kind !== 'pro_seller' && kind !== 'premium_seller') continue;
      await syncProSellerFromSubscription(admin, sub, userId);
      const end = new Date(sub.current_period_end * 1000);
      if (isProStatusActive(sub.status, end)) {
        proActive = true;
        proUntil = end.toISOString();
      }
    }
  }

  if (!proActive) {
    const { data: profile } = await admin
      .from('profiles')
      .select('is_pro_seller, pro_seller_until, is_premium, premium_until')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.is_pro_seller && profile.pro_seller_until) {
      const until = new Date(profile.pro_seller_until);
      if (until.getTime() > Date.now()) {
        proActive = true;
        proUntil = profile.pro_seller_until;
      }
    } else if (profile?.is_premium && profile.premium_until) {
      const until = new Date(profile.premium_until);
      if (until.getTime() > Date.now()) {
        proActive = true;
        proUntil = profile.premium_until;
      }
    }
  }

  return { pro_seller_active: proActive, pro_seller_until: proUntil };
}

export async function syncProSellerFromCheckoutSession(
  admin: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<{ pro_seller_active: boolean; pro_seller_until: string | null }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });
  if (session.metadata?.user_id && session.metadata.user_id !== userId) {
    throw new Error('Session does not belong to this user');
  }
  const sub = session.subscription;
  if (sub && typeof sub !== 'string') {
    await syncProSellerFromSubscription(admin, sub, userId);
  }
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (customerId) {
    return syncProSellerForStripeCustomer(admin, userId, customerId);
  }
  return { pro_seller_active: false, pro_seller_until: null };
}
