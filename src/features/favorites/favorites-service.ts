import { getSupabaseEnv, supabaseRestGet } from '@/lib/supabase-rest';
import type { FavoriteListItem, FavoriteRow } from '@/types/favorites';
import type { FeedListingItem } from '@/types/feed';

export async function fetchFavoriteIds(
  accessToken: string,
  userId: string
): Promise<string[]> {
  const rows = await supabaseRestGet<{ listing_id: string }>(
    `favorites?user_id=eq.${userId}&select=listing_id`,
    accessToken
  );
  return rows.map((r) => r.listing_id);
}

export async function fetchFavorites(
  accessToken: string,
  userId: string
): Promise<FavoriteListItem[]> {
  const rows = await supabaseRestGet<FavoriteRow>(
    `favorites?user_id=eq.${userId}&select=listing_id,created_at,listings(id,title,price,category,status,published_at,listing_images(thumb_path,storage_path,sort_order))&order=created_at.desc`,
    accessToken
  );

  const items: FavoriteListItem[] = [];

  for (const row of rows) {
    if (!row.listings) continue;
    const images = [...(row.listings.listing_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    items.push({
      favoriteId: row.listing_id,
      favoritedAt: row.created_at,
      listing: {
        ...row.listings,
        price: Number(row.listings.price),
        listing_images: images,
      },
    });
  }

  return items;
}

export async function setFavorite(
  accessToken: string,
  listingId: string,
  favorited: boolean,
  userId: string
): Promise<void> {
  const { url, key } = getSupabaseEnv();

  if (favorited) {
    const res = await fetch(`${url}/rest/v1/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ user_id: userId, listing_id: listingId }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (!text.includes('duplicate') && !text.includes('23505')) {
        throw new Error('Could not save favorite');
      }
    }
    return;
  }

  const res = await fetch(
    `${url}/rest/v1/favorites?user_id=eq.${userId}&listing_id=eq.${listingId}`,
    {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error('Could not remove favorite');
  }
}

export function favoriteThumbPath(item: FavoriteListItem): string | null {
  const first = item.listing.listing_images[0];
  return first?.thumb_path ?? first?.storage_path ?? null;
}

/** Map a saved listing to feed grid card shape (no seller fields in favorites API). */
export function favoriteToFeedListingItem(item: FavoriteListItem): FeedListingItem {
  const { listing } = item;
  return {
    id: listing.id,
    title: listing.title,
    price: listing.price,
    effective_price: listing.price,
    category: listing.category,
    status: listing.status,
    featured_until: null,
    published_at: listing.published_at,
    image_count: listing.listing_images.length,
    seller_id: '',
    seller_display_name: '',
    seller_username: '',
    seller_avatar_url: null,
    seller_is_pro_seller: false,
    thumb_path: favoriteThumbPath(item),
  };
}
