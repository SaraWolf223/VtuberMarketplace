import { FOUNDING_FREE_BOOSTS_PER_MONTH } from '@/constants/founding';
import { FREE_LISTINGS_PER_MONTH, PREMIUM_LISTINGS_PER_MONTH } from '@/constants/listings';
import { PREMIUM_FREE_BOOSTS_PER_MONTH } from '@/constants/premium';
import type { ProfileRow } from '@/features/profile/profile-service';
import { isPremiumActive } from '@/features/monetization/premium-service';
import { getSupabaseEnv, supabaseRestGet } from '@/lib/supabase-rest';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

type BoostCreditsRow = {
  credits_total: number;
  credits_used: number;
};

type PromoBoostRow = {
  boosts_remaining: number | null;
};

export type SellerBenefits = {
  premium_active: boolean;
  premium_until: string | null;
  is_founding_seller: boolean;
  promo_boosts_remaining: number;
  boost_credits: {
    period_start: string;
    credits_total: number;
    credits_used: number;
    credits_remaining: number;
  };
  founding_boost_credits: {
    period_start: string;
    credits_total: number;
    credits_used: number;
    credits_remaining: number;
  };
  listings: {
    created_this_month: number;
    limit: number;
    remaining: number;
    free_limit: number;
    premium_limit: number;
  };
  has_stripe_customer: boolean;
};

function currentCreditPeriodStart(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

async function countListingsCreatedThisMonth(
  accessToken: string,
  userId: string
): Promise<number> {
  const monthStart = `${currentCreditPeriodStart()}T00:00:00.000Z`;
  const { url, key } = getSupabaseEnv();
  const res = await fetch(
    `${url}/rest/v1/listing_create_log?user_id=eq.${userId}&created_at=gte.${encodeURIComponent(monthStart)}&select=id`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'count=exact',
      },
    }
  );

  if (!res.ok) {
    return 0;
  }

  const range = res.headers.get('content-range');
  if (!range) return 0;
  const total = range.split('/')[1];
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Load seller limits via PostgREST (same data as get-seller-benefits edge, without edge hop). */
export async function fetchSellerBenefits(
  accessToken: string,
  userId: string,
  profile: ProfileRow
): Promise<SellerBenefits> {
  const periodStart = currentCreditPeriodStart();
  const premiumActive = isPremiumActive(!!profile.is_premium, profile.premium_until);
  const foundingActive = !!profile.is_founding_seller;

  let creditsTotal = PREMIUM_FREE_BOOSTS_PER_MONTH;
  let creditsUsed = 0;
  if (premiumActive) {
    const rows = await supabaseRestGet<BoostCreditsRow>(
      `premium_boost_credits?user_id=eq.${userId}&period_start=eq.${periodStart}&select=credits_total,credits_used`,
      accessToken
    );
    if (rows[0]) {
      creditsTotal = rows[0].credits_total;
      creditsUsed = rows[0].credits_used;
    }
  }

  let foundingTotal = FOUNDING_FREE_BOOSTS_PER_MONTH;
  let foundingUsed = 0;
  if (foundingActive) {
    const rows = await supabaseRestGet<BoostCreditsRow>(
      `founding_boost_credits?user_id=eq.${userId}&period_start=eq.${periodStart}&select=credits_total,credits_used`,
      accessToken
    );
    if (rows[0]) {
      foundingTotal = rows[0].credits_total;
      foundingUsed = rows[0].credits_used;
    }
  }

  const promoRows = await supabaseRestGet<PromoBoostRow>(
    `promo_redemptions?user_id=eq.${userId}&boosts_remaining=gt.0&select=boosts_remaining&order=redeemed_at.asc&limit=1`,
    accessToken
  );

  const listingsCreated = await countListingsCreatedThisMonth(accessToken, userId);
  const listingLimit = premiumActive ? PREMIUM_LISTINGS_PER_MONTH : FREE_LISTINGS_PER_MONTH;

  return {
    premium_active: premiumActive,
    premium_until: profile.premium_until ?? null,
    is_founding_seller: foundingActive,
    promo_boosts_remaining: promoRows[0]?.boosts_remaining ?? 0,
    boost_credits: {
      period_start: periodStart,
      credits_total: creditsTotal,
      credits_used: creditsUsed,
      credits_remaining: premiumActive ? Math.max(0, creditsTotal - creditsUsed) : 0,
    },
    founding_boost_credits: {
      period_start: periodStart,
      credits_total: foundingTotal,
      credits_used: foundingUsed,
      credits_remaining: foundingActive ? Math.max(0, foundingTotal - foundingUsed) : 0,
    },
    listings: {
      created_this_month: listingsCreated,
      limit: listingLimit,
      remaining: Math.max(0, listingLimit - listingsCreated),
      free_limit: FREE_LISTINGS_PER_MONTH,
      premium_limit: PREMIUM_LISTINGS_PER_MONTH,
    },
    has_stripe_customer: !!profile.stripe_customer_id,
  };
}

export type SyncPremiumResult = {
  premium_active: boolean;
  premium_until: string | null;
};

export async function syncPremiumAccount(
  accessToken: string,
  sessionId?: string
): Promise<SyncPremiumResult> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/sync-premium`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
  });

  const json = (await res.json()) as EdgeEnvelope<SyncPremiumResult>;
  if (json.ok && json.data) return json.data;
  throw new Error(json.error?.message ?? 'Could not activate Premium');
}

export async function openPremiumBillingPortal(accessToken: string): Promise<string> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/create-premium-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  const json = (await res.json()) as EdgeEnvelope<{ url: string }>;
  if (json.ok && json.data?.url) return json.data.url;
  throw new Error(json.error?.message ?? 'Could not open billing portal');
}
