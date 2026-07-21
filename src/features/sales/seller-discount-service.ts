import { supabase } from '@/lib/supabase';

// Migrations 139+ are not yet in generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function upsertListingSale(input: {
  listing_id: string;
  percent_off?: number | null;
  sale_price_cents?: number | null;
  starts_at?: string | null;
  ends_at: string;
  sale_id?: string | null;
}): Promise<{ sale_id: string; effective_price_cents: number }> {
  const { data, error } = await db.rpc('upsert_listing_sale_period', {
    p_listing_id: input.listing_id,
    p_percent_off: input.percent_off ?? null,
    p_sale_price_cents: input.sale_price_cents ?? null,
    p_starts_at: input.starts_at ?? null,
    p_ends_at: input.ends_at,
    p_sale_id: input.sale_id ?? null,
  });
  if (error) throw error;
  const row = data as {
    ok?: boolean;
    sale_id?: string;
    effective_price_cents?: number;
    error?: string;
  };
  if (!row?.ok || !row.sale_id) throw new Error(row?.error ?? 'Sale save failed');
  return { sale_id: row.sale_id, effective_price_cents: row.effective_price_cents ?? 0 };
}

export async function deactivateListingSale(saleId: string): Promise<void> {
  const { data, error } = await db.rpc('deactivate_listing_sale_period', {
    p_sale_id: saleId,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; error?: string };
  if (!row?.ok) throw new Error(row?.error ?? 'Deactivate failed');
}

export async function createSellerPromoCode(input: {
  code: string;
  type: 'percent_off' | 'flat_off_cents';
  value: number;
  max_redemptions?: number | null;
  expires_at?: string | null;
}): Promise<string> {
  const { data, error } = await db.rpc('create_seller_promo_code', {
    p_code: input.code,
    p_type: input.type,
    p_value: input.value,
    p_max_redemptions: input.max_redemptions ?? null,
    p_expires_at: input.expires_at ?? null,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; promo_code_id?: string; error?: string };
  if (!row?.ok || !row.promo_code_id) throw new Error(row?.error ?? 'Promo create failed');
  return row.promo_code_id;
}
