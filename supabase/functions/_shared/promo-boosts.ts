import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export async function getAvailablePromoBoost(
  admin: SupabaseClient,
  userId: string
): Promise<{ redemption_id: string; remaining: number } | null> {
  const { data } = await admin
    .from('promo_redemptions')
    .select('id, boosts_remaining')
    .eq('user_id', userId)
    .gt('boosts_remaining', 0)
    .order('redeemed_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data?.boosts_remaining) return null;
  return { redemption_id: data.id, remaining: data.boosts_remaining };
}

export async function consumePromoBoost(
  admin: SupabaseClient,
  promo: { redemption_id: string; remaining: number }
): Promise<boolean> {
  const { data, error } = await admin
    .from('promo_redemptions')
    .update({ boosts_remaining: promo.remaining - 1 })
    .eq('id', promo.redemption_id)
    .eq('boosts_remaining', promo.remaining)
    .select('id')
    .maybeSingle();

  return !error && !!data;
}
