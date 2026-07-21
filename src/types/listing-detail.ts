import type { ListingCategory } from '@/types/enums';

export type ListingDetailImage = {
  storage_path: string;
  sort_order: number;
};

export type ListingDetailSeller = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  college_badge_active?: boolean;
  is_premium?: boolean;
  is_founding_seller?: boolean;
  is_admin?: boolean;
};

export type ListingDetail = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: ListingCategory;
  zip_code: string;
  status: 'draft' | 'active' | 'sold' | 'expired' | 'deleted' | 'paused_pending_review';
  boosted_until: string | null;
  published_at: string;
  expires_at: string;
  seller_id: string;
  is_own: boolean;
};

export type ListingDetailResponse = {
  listing: ListingDetail;
  seller: ListingDetailSeller;
  images: ListingDetailImage[];
  distance_miles: number | null;
  is_favorited: boolean;
};
