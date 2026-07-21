// TODO(VtuberMarketplace): superseded by get_seller_dashboard_summary RPC.
// See docs/10-Monetization_System.md §6.2 — still references removed premium/founding fields.
import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  currentCreditPeriodStart,
  ensureMonthlyCreditsRow,
  PREMIUM_CREDITS_PER_MONTH,
} from '../_shared/premium-credits.ts';
import {
  ensureFoundingCreditsRow,
  FOUNDING_CREDITS_PER_MONTH,
} from '../_shared/founding-credits.ts';
import { isPremiumStatusActive } from '../_shared/apply-premium.ts';
import {
  countListingsCreatedThisMonth,
  FREE_LISTINGS_PER_MONTH,
  listingLimitForPremium,
  PREMIUM_LISTINGS_PER_MONTH,
} from '../_shared/listing-quota.ts';
import { getAvailablePromoBoost } from '../_shared/promo-boosts.ts';

async function resolvePremiumActive(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string
): Promise<{ active: boolean; premiumUntil: string | null }> {
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('is_premium, premium_until')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

  let active =
    !!profile?.is_premium &&
    (!profile.premium_until || new Date(profile.premium_until).getTime() > Date.now());

  let premiumUntil = profile?.premium_until ?? null;

  if (!active) {
    const { data: sub } = await admin
      .from('premium_subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due', 'canceled'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub?.current_period_end) {
      const end = new Date(sub.current_period_end);
      active = isPremiumStatusActive(sub.status, end);
      if (active) premiumUntil = sub.current_period_end;
    }
  }

  return { active, premiumUntil };
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
  if ('response' in auth) {
    return withCors(auth.response);
  }

  try {
    const admin = createSupabaseAdmin();
    const { active: premiumActive, premiumUntil } = await resolvePremiumActive(
      admin,
      auth.user.id
    );

    const periodStart = currentCreditPeriodStart();
    let creditsTotal = PREMIUM_CREDITS_PER_MONTH;
    let creditsUsed = 0;

    if (premiumActive) {
      await ensureMonthlyCreditsRow(admin, auth.user.id, periodStart);
      const { data: row } = await admin
        .from('premium_boost_credits')
        .select('credits_total, credits_used')
        .eq('user_id', auth.user.id)
        .eq('period_start', periodStart)
        .maybeSingle();

      if (row) {
        creditsTotal = row.credits_total;
        creditsUsed = row.credits_used;
      }
    }

    const listingsCreated = await countListingsCreatedThisMonth(admin, auth.user.id);
    const listingLimit = listingLimitForPremium(premiumActive);

    const { data: profile, error: profileDetailsError } = await admin
      .from('profiles')
      .select('stripe_customer_id, is_founding_seller')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileDetailsError) {
      throw profileDetailsError;
    }

    const foundingActive = !!profile?.is_founding_seller;
    let foundingTotal = FOUNDING_CREDITS_PER_MONTH;
    let foundingUsed = 0;

    if (foundingActive) {
      await ensureFoundingCreditsRow(admin, auth.user.id, periodStart);
      const { data: foundingRow } = await admin
        .from('founding_boost_credits')
        .select('credits_total, credits_used')
        .eq('user_id', auth.user.id)
        .eq('period_start', periodStart)
        .maybeSingle();

      if (foundingRow) {
        foundingTotal = foundingRow.credits_total;
        foundingUsed = foundingRow.credits_used;
      }
    }

    const promo = await getAvailablePromoBoost(admin, auth.user.id);

    return withCors(
      okResponse({
        premium_active: premiumActive,
        premium_until: premiumUntil,
        is_founding_seller: foundingActive,
        promo_boosts_remaining: promo?.remaining ?? 0,
        boost_credits: {
          period_start: periodStart,
          credits_total: creditsTotal,
          credits_used: creditsUsed,
          credits_remaining: premiumActive
            ? Math.max(0, creditsTotal - creditsUsed)
            : 0,
        },
        founding_boost_credits: {
          period_start: periodStart,
          credits_total: foundingTotal,
          credits_used: foundingUsed,
          credits_remaining: foundingActive
            ? Math.max(0, foundingTotal - foundingUsed)
            : 0,
        },
        listings: {
          created_this_month: listingsCreated,
          limit: listingLimit,
          remaining: Math.max(0, listingLimit - listingsCreated),
          free_limit: FREE_LISTINGS_PER_MONTH,
          premium_limit: PREMIUM_LISTINGS_PER_MONTH,
        },
        has_stripe_customer: !!profile?.stripe_customer_id,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not load benefits';
    return withCors(errorResponse(message, 500, 'BENEFITS_FAILED'));
  }
});
