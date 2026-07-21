import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { currentCreditPeriodStart } from './premium-credits.ts';

export const FOUNDING_CREDITS_PER_MONTH = 10;

export async function ensureFoundingCreditsRow(
  admin: SupabaseClient,
  userId: string,
  periodStart: string = currentCreditPeriodStart()
): Promise<void> {
  const { error } = await admin.from('founding_boost_credits').upsert(
    {
      user_id: userId,
      period_start: periodStart,
      credits_total: FOUNDING_CREDITS_PER_MONTH,
      credits_used: 0,
    },
    { onConflict: 'user_id,period_start', ignoreDuplicates: true }
  );
  if (error && !error.message.includes('duplicate')) {
    throw error;
  }
}

export type FoundingCreditAvailability = {
  remaining: number;
  credits_total: number;
  credits_used: number;
  period_start: string;
};

export async function getAvailableFoundingCredit(
  admin: SupabaseClient,
  userId: string
): Promise<FoundingCreditAvailability | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('is_founding_seller')
    .eq('id', userId)
    .single();

  if (!profile?.is_founding_seller) return null;

  const periodStart = currentCreditPeriodStart();
  await ensureFoundingCreditsRow(admin, userId, periodStart);

  const { data: row, error } = await admin
    .from('founding_boost_credits')
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
