import type { ListingCategory } from '@/types/enums';

export type FeedSort = 'newest' | 'price_low' | 'price_high' | 'featured';

export type FeedListingItem = {
  id: string;
  title: string;
  price: number;
  effective_price?: number;
  on_sale?: boolean;
  category: ListingCategory;
  asset_type?: string | null;
  license_type?: string | null;
  status: string;
  featured?: boolean;
  featured_until?: string | null;
  /** @deprecated Use featured_until — kept for older card helpers */
  boosted_until?: string | null;
  published_at: string;
  image_count: number;
  seller_id: string;
  is_mature?: boolean;
  has_customization?: boolean;
  has_setup?: boolean;
  has_support_plan?: boolean;
  seller_display_name: string;
  seller_username: string;
  seller_avatar_url: string | null;
  seller_is_pro_seller?: boolean;
  /** Alias for Pro Seller highlight helpers that still read is_premium */
  seller_is_premium?: boolean;
  seller_rating_avg?: number | null;
  seller_rating_count?: number | null;
  seller_is_admin?: boolean;
  thumb_path: string | null;
};

export type FeedPage = {
  items: FeedListingItem[];
  next_cursor: string | null;
};

export type FeedQueryParams = {
  category: ListingCategory | null;
  minPrice: number | null;
  maxPrice: number | null;
  search: string;
  sort: FeedSort;
  listingStatus: 'active' | 'sold';
  publishedAfter: string | null;
  publishedBefore: string | null;
  minSellerRating: number | null;
};
