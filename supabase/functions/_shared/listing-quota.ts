import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { currentCreditPeriodStart } from './premium-credits.ts';

export const FREE_LISTINGS_PER_MONTH = 5;
export const PREMIUM_LISTINGS_PER_MONTH = 50;

function monthStartIso(): string {
  const period = currentCreditPeriodStart();
  return `${period}T00:00:00.000Z`;
}

export async function countListingsCreatedThisMonth(
  admin: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await admin
    .from('listing_create_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStartIso());

  if (error) throw error;
  return count ?? 0;
}

export function listingLimitForPremium(isPremium: boolean): number {
  return isPremium ? PREMIUM_LISTINGS_PER_MONTH : FREE_LISTINGS_PER_MONTH;
}

export async function assertListingQuota(
  admin: SupabaseClient,
  userId: string,
  isPremium: boolean
): Promise<{ ok: true } | { ok: false; message: string; code: string }> {
  const limit = listingLimitForPremium(isPremium);
  const used = await countListingsCreatedThisMonth(admin, userId);
  if (used >= limit) {
    const tier = isPremium ? 'Premium' : 'free';
    return {
      ok: false,
      code: 'LISTING_QUOTA',
      message: `${tier} sellers can post ${limit} listings per month. You've used ${used} this month.`,
    };
  }
  return { ok: true };
}
