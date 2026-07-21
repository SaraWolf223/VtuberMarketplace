// TODO(VtuberMarketplace): superseded by apply-featured-placement webhook path.
// See docs/10-Monetization_System.md §5.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { getStripe } from './stripe.ts';
import {
  currentCreditPeriodStart,
  getAvailablePremiumCredit,
} from './premium-credits.ts';
import { getAvailableFoundingCredit } from './founding-credits.ts';
import { computeExpiresAtAfterBoost } from './listing-lifecycle.ts';
import { getBoostDurationHours } from './platform-settings.ts';
import { consumePromoBoost, getAvailablePromoBoost } from './promo-boosts.ts';

export type ApplyBoostResult =
  | {
      ok: true;
      boosted_until: string;
      expires_at?: string;
      expiry_extended?: boolean;
      source?: 'paid' | 'premium_credit' | 'founding_credit' | 'promo';
    }
  | { ok: false; code: string; message: string };

async function applyBoostToListing(
  admin: SupabaseClient,
  listingId: string,
  userId: string,
  source: 'paid' | 'premium_credit' | 'founding_credit' | 'promo',
  paymentIntentId: string | null,
  amountCents: number,
  boostHours: number
): Promise<ApplyBoostResult> {
  const { data: listing, error: listingError } = await admin
    .from('listings')
    .select('id, seller_id, status, boosted_until, expires_at')
    .eq('id', listingId)
    .single();

  if (listingError || !listing) {
    return { ok: false, code: 'LISTING_NOT_FOUND', message: 'Listing not found' };
  }

  if (listing.seller_id !== userId) {
    return { ok: false, code: 'SELLER_MISMATCH', message: 'Not your listing' };
  }

  if (listing.status !== 'active') {
    return { ok: false, code: 'LISTING_INACTIVE', message: 'Only active listings can be boosted' };
  }

  const now = new Date();
  const currentEnd = listing.boosted_until ? new Date(listing.boosted_until) : null;
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const boostedUntil = new Date(base.getTime() + boostHours * 60 * 60 * 1000);
  const newExpiresAt = computeExpiresAtAfterBoost(listing.expires_at, now);

  const listingUpdate: { boosted_until: string; expires_at?: string } = {
    boosted_until: boostedUntil.toISOString(),
  };
  if (newExpiresAt) {
    listingUpdate.expires_at = newExpiresAt;
  }

  const { error: updateError } = await admin
    .from('listings')
    .update(listingUpdate)
    .eq('id', listingId);

  if (updateError) {
    return { ok: false, code: 'UPDATE_FAILED', message: updateError.message };
  }

  const { error: purchaseError } = await admin.from('boost_purchases').insert({
    user_id: userId,
    listing_id: listingId,
    stripe_payment_intent_id: paymentIntentId,
    amount_cents: amountCents,
    source,
  });

  if (purchaseError && !purchaseError.message.includes('duplicate')) {
    return { ok: false, code: 'PURCHASE_LOG_FAILED', message: purchaseError.message };
  }

  return {
    ok: true,
    boosted_until: boostedUntil.toISOString(),
    ...(newExpiresAt ? { expires_at: newExpiresAt, expiry_extended: true } : {}),
    source,
  };
}

export async function applyBoostWithPremiumCredit(
  admin: SupabaseClient,
  userId: string,
  listingId: string
): Promise<ApplyBoostResult> {
  const credit = await getAvailablePremiumCredit(admin, userId);
  if (!credit) {
    return { ok: false, code: 'NO_CREDIT', message: 'No premium boost credits remaining' };
  }

  const periodStart = currentCreditPeriodStart();
  const { data: consumed, error: creditError } = await admin
    .from('premium_boost_credits')
    .update({ credits_used: credit.credits_used + 1 })
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .lt('credits_used', credit.credits_total)
    .select('id')
    .maybeSingle();

  if (creditError || !consumed) {
    return { ok: false, code: 'NO_CREDIT', message: 'No premium boost credits remaining' };
  }

  const boostHours = await getBoostDurationHours(admin);
  return applyBoostToListing(admin, listingId, userId, 'premium_credit', null, 0, boostHours);
}

export async function applyBoostWithFoundingCredit(
  admin: SupabaseClient,
  userId: string,
  listingId: string
): Promise<ApplyBoostResult> {
  const credit = await getAvailableFoundingCredit(admin, userId);
  if (!credit) {
    return {
      ok: false,
      code: 'NO_CREDIT',
      message: 'No Founding Seller boost credits remaining',
    };
  }

  const periodStart = currentCreditPeriodStart();
  const { data: consumed, error: creditError } = await admin
    .from('founding_boost_credits')
    .update({ credits_used: credit.credits_used + 1 })
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .lt('credits_used', credit.credits_total)
    .select('id')
    .maybeSingle();

  if (creditError || !consumed) {
    return {
      ok: false,
      code: 'NO_CREDIT',
      message: 'No Founding Seller boost credits remaining',
    };
  }

  const boostHours = await getBoostDurationHours(admin);
  return applyBoostToListing(admin, listingId, userId, 'founding_credit', null, 0, boostHours);
}

export async function applyBoostWithPromoCredit(
  admin: SupabaseClient,
  userId: string,
  listingId: string
): Promise<ApplyBoostResult> {
  const promo = await getAvailablePromoBoost(admin, userId);
  if (!promo) {
    return { ok: false, code: 'NO_PROMO_BOOST', message: 'No promo boost credits remaining' };
  }

  const consumed = await consumePromoBoost(admin, promo);
  if (!consumed) {
    return { ok: false, code: 'NO_PROMO_BOOST', message: 'No promo boost credits remaining' };
  }

  const boostHours = await getBoostDurationHours(admin);
  return applyBoostToListing(admin, listingId, userId, 'promo', null, 0, boostHours);
}

export async function applyBoostFromPaymentIntent(
  admin: SupabaseClient,
  paymentIntentId: string,
  callerUserId?: string
): Promise<ApplyBoostResult> {
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status !== 'succeeded') {
    return { ok: false, code: 'PAYMENT_NOT_COMPLETE', message: 'Payment not completed' };
  }

  if (pi.metadata?.type !== 'boost_24h') {
    return { ok: false, code: 'INVALID_PAYMENT', message: 'Not a boost payment' };
  }

  const listingId = pi.metadata?.listing_id;
  const userId = pi.metadata?.user_id;
  if (!listingId || !userId) {
    return { ok: false, code: 'INVALID_METADATA', message: 'Missing payment metadata' };
  }

  if (callerUserId && callerUserId !== userId) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'This payment belongs to another account',
    };
  }

  const { data: existing } = await admin
    .from('boost_purchases')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (existing) {
    const { data: listing } = await admin
      .from('listings')
      .select('boosted_until')
      .eq('id', listingId)
      .single();
    return {
      ok: true,
      boosted_until: listing?.boosted_until ?? new Date().toISOString(),
    };
  }

  const baseFromMeta = parseInt(pi.metadata?.base_amount_cents ?? '', 10);
  const amountCents =
    Number.isFinite(baseFromMeta) && baseFromMeta > 0 ? baseFromMeta : 100;

  const boostHours = await getBoostDurationHours(admin);
  return applyBoostToListing(
    admin,
    listingId,
    userId,
    'paid',
    paymentIntentId,
    amountCents,
    boostHours
  );
}

export async function recordWebhookEvent(
  admin: SupabaseClient,
  event: Stripe.Event
): Promise<boolean> {
  const { error } = await admin.from('webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
  });

  if (error) {
    if (error.message.includes('duplicate') || error.code === '23505') {
      return false;
    }
    throw error;
  }
  return true;
}
