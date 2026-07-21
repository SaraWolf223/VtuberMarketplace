import { FREE_LISTINGS_PER_MONTH, PREMIUM_LISTINGS_PER_MONTH } from '@/constants/listings';
import { PRO_SELLER_FEATURED_CREDITS_PER_MONTH } from '@/constants/pro-seller';
import type { ProfileRow } from '@/features/profile/profile-service';
import {
  isProSellerActive,
  isProSellerOrLegacyPremium,
  openProSellerBillingPortal,
  syncProSellerAccount,
  type SyncProSellerResult,
} from '@/features/monetization/pro-seller-service';
import { getSupabaseEnv, supabaseRestGet } from '@/lib/supabase-rest';

type FeaturedCreditsRow = {
  credits_total: number;
  credits_used: number;
};

export type SellerBenefits = {
  pro_seller_active: boolean;
  pro_seller_until: string | null;
  /** @deprecated alias */
  premium_active: boolean;
  /** @deprecated alias */
  premium_until: string | null;
  featured_credits: {
    period_start: string;
    credits_total: number;
    credits_used: number;
    credits_remaining: number;
  };
  /** @deprecated use featured_credits */
  boost_credits: SellerBenefits['featured_credits'];
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

function readProSellerFields(profile: ProfileRow & {
  is_pro_seller?: boolean | null;
  pro_seller_until?: string | null;
}) {
  const proActive = isProSellerOrLegacyPremium(profile);
  const until =
    (proActive && profile.pro_seller_until) ||
    (proActive && profile.premium_until) ||
    null;
  return { proActive, until };
}

/** Load seller limits via PostgREST (mirrors get_seller_dashboard_summary fields). */
export async function fetchSellerBenefits(
  accessToken: string,
  userId: string,
  profile: ProfileRow
): Promise<SellerBenefits> {
  const periodStart = currentCreditPeriodStart();
  const { proActive, until } = readProSellerFields(profile as ProfileRow & {
    is_pro_seller?: boolean | null;
    pro_seller_until?: string | null;
  });

  let creditsTotal = PRO_SELLER_FEATURED_CREDITS_PER_MONTH;
  let creditsUsed = 0;
  if (proActive) {
    const rows = await supabaseRestGet<FeaturedCreditsRow>(
      `featured_listing_credits?user_id=eq.${userId}&period_start=eq.${periodStart}&select=credits_total,credits_used`,
      accessToken
    );
    if (rows[0]) {
      creditsTotal = rows[0].credits_total;
      creditsUsed = rows[0].credits_used;
    }
  }

  const listingsCreated = await countListingsCreatedThisMonth(accessToken, userId);
  const listingLimit = proActive ? PREMIUM_LISTINGS_PER_MONTH : FREE_LISTINGS_PER_MONTH;

  const credits = {
    period_start: periodStart,
    credits_total: creditsTotal,
    credits_used: creditsUsed,
    credits_remaining: proActive ? Math.max(0, creditsTotal - creditsUsed) : 0,
  };

  return {
    pro_seller_active: proActive,
    pro_seller_until: until,
    premium_active: proActive,
    premium_until: until,
    featured_credits: credits,
    boost_credits: credits,
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

export type SyncPremiumResult = SyncProSellerResult & {
  premium_active: boolean;
  premium_until: string | null;
};

export async function syncPremiumAccount(
  accessToken: string,
  sessionId?: string
): Promise<SyncPremiumResult> {
  const synced = await syncProSellerAccount(accessToken, sessionId);
  return {
    ...synced,
    premium_active: synced.pro_seller_active ?? !!synced.premium_active,
    premium_until: synced.pro_seller_until ?? synced.premium_until ?? null,
  };
}

export async function openPremiumBillingPortal(accessToken: string): Promise<string> {
  return openProSellerBillingPortal(accessToken);
}

export { isProSellerActive, isProSellerOrLegacyPremium };
