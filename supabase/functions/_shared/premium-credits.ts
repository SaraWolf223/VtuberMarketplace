import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const PREMIUM_CREDITS_PER_MONTH = 10;

/** First day of current UTC month (DATE). */
export function currentCreditPeriodStart(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export async function ensureMonthlyCreditsRow(
  admin: SupabaseClient,
  userId: string,
  periodStart: string = currentCreditPeriodStart()
): Promise<void> {
  const { error } = await admin.from('premium_boost_credits').upsert(
    {
      user_id: userId,
      period_start: periodStart,
      credits_total: PREMIUM_CREDITS_PER_MONTH,
      credits_used: 0,
    },
    { onConflict: 'user_id,period_start', ignoreDuplicates: true }
  );
  if (error && !error.message.includes('duplicate')) {
    throw error;
  }
}

export type PremiumCreditAvailability = {
  remaining: number;
  credits_total: number;
  credits_used: number;
  period_start: string;
};

export async function getAvailablePremiumCredit(
  admin: SupabaseClient,
  userId: string
): Promise<PremiumCreditAvailability | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('id', userId)
    .single();

  if (!profile?.is_premium) return null;
  if (profile.premium_until && new Date(profile.premium_until).getTime() <= Date.now()) {
    return null;
  }

  const periodStart = currentCreditPeriodStart();
  await ensureMonthlyCreditsRow(admin, userId, periodStart);

  const { data: row, error } = await admin
    .from('premium_boost_credits')
    .select('credits_total, credits_used, period_start')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .single();

  if (error || !row || row.credits_used >= row.credits_total) {
    return null;
  }

  return {
    remaining: row.credits_total - row.credits_used,
    credits_total: row.credits_total,
    credits_used: row.credits_used,
    period_start: row.period_start,
  };
}
