import { supabaseRpc } from '@/lib/supabase-rest';
import type { FeedPage, FeedQueryParams } from '@/types/feed';

type RpcFeedResponse = {
  items: FeedPage['items'];
  next_cursor: string | null;
};

function mapFeedItem(raw: FeedPage['items'][number]): FeedPage['items'][number] {
  return {
    ...raw,
    seller_is_premium: raw.seller_is_pro_seller ?? raw.seller_is_premium ?? false,
    boosted_until: raw.featured_until ?? raw.boosted_until ?? null,
    effective_price: raw.effective_price ?? raw.price,
  };
}

export async function fetchFeedPage(
  accessToken: string,
  params: FeedQueryParams,
  cursor: string | null
): Promise<FeedPage> {
  const result = await supabaseRpc<RpcFeedResponse>(
    'get_feed_listings',
    {
      p_category: params.category,
      p_min_price: params.minPrice,
      p_max_price: params.maxPrice,
      p_search: params.search.trim() || null,
      p_sort: params.sort,
      p_cursor: cursor,
      p_limit: 20,
      p_status: params.listingStatus,
      p_published_after: params.publishedAfter,
      p_published_before: params.publishedBefore,
      p_min_seller_rating: params.minSellerRating,
    },
    accessToken,
    20000
  );

  return {
    items: (result.items ?? []).map(mapFeedItem),
    next_cursor: result.next_cursor,
  };
}
