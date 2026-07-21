import { supabaseRpc } from '@/lib/supabase-rest';
import type { SellerProfileListingItem } from '@/types/seller-profile-listings';
import type { ListingCategory } from '@/types/enums';

type RpcRow = {
  id: string;
  title: string;
  price: number;
  category: string;
  status: 'active' | 'sold';
  expires_at: string;
  published_at: string;
  boosted_until: string | null;
  thumb_path: string | null;
};

export async function fetchSellerProfileListings(
  accessToken: string,
  sellerId: string
): Promise<SellerProfileListingItem[]> {
  const rows = await supabaseRpc<RpcRow[] | null>(
    'get_seller_profile_listings',
    { p_seller_id: sellerId },
    accessToken
  );

  if (!rows?.length) return [];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    price: Number(row.price),
    category: row.category as ListingCategory,
    status: row.status,
    expires_at: row.expires_at,
    published_at: row.published_at,
    boosted_until: row.boosted_until,
    thumb_path: row.thumb_path,
  }));
}
