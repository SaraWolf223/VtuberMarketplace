import type { ListingCategory } from '@/types/enums';

export type MyListingStatus = 'active' | 'sold' | 'expired';

export type MyListingImage = {
  storage_path: string;
  thumb_path: string;
  sort_order: number;
};

export type MyListingItem = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: ListingCategory;
  zip_code?: string | null;
  status: MyListingStatus | 'draft' | 'deleted' | 'paused_pending_review';
  expires_at: string;
  published_at: string;
  boosted_until: string | null;
  /** Preferred VTuber field — maps from API when present */
  featured_until?: string | null;
  listing_images: MyListingImage[];
};
