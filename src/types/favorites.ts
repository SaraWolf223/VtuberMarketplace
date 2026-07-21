import type { ListingCategory } from '@/types/enums';

export type FavoriteListingEmbed = {
  id: string;
  title: string;
  price: number;
  category: ListingCategory;
  status: 'active' | 'sold' | 'expired' | 'draft' | 'deleted';
  published_at: string;
  listing_images: { thumb_path: string; storage_path: string; sort_order: number }[];
};

export type FavoriteRow = {
  listing_id: string;
  created_at: string;
  listings: FavoriteListingEmbed | null;
};

export type FavoriteListItem = {
  favoriteId: string;
  favoritedAt: string;
  listing: FavoriteListingEmbed;
};
