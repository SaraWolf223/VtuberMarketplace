import { getSupabaseEnv } from '@/lib/supabase-rest';

export type ListingCategoryRow = {
  slug: string;
  label: string;
  icon_name: string;
  sort_order: number;
  is_active: boolean;
};

/**
 * Public, unauthenticated read of active listing categories — used to build
 * the dynamic category picker/filter list. Falls back to the bundled
 * defaults in `src/types/enums.ts` on any failure (offline-safe).
 */
export async function fetchListingCategories(timeoutMs = 8000): Promise<ListingCategoryRow[]> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `${url}/rest/v1/listing_categories?select=slug,label,icon_name,sort_order,is_active&is_active=eq.true&order=sort_order.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: controller.signal }
    );
    if (!res.ok) throw new Error(`categories request failed (${res.status})`);
    return (await res.json()) as ListingCategoryRow[];
  } finally {
    clearTimeout(timer);
  }
}
