export type ListingReviewStatus = {
  has_order: boolean;
  order_id?: string | null;
  has_review: boolean;
  can_review: boolean;
  is_own?: boolean;
};

export type SellerReview = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  listing_id: string;
  buyer_id: string;
  buyer_display_name: string;
  buyer_username: string;
  buyer_avatar_url: string | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  rating_avg: number;
  rating_count: number;
  listing_count: number;
  /** @deprecated use is_pro_seller */
  is_premium?: boolean;
  is_pro_seller?: boolean;
  is_founding_seller?: boolean;
  created_at: string;
  college_badge_active?: boolean;
  is_admin?: boolean;
  website_url?: string | null;
  portfolio_url?: string | null;
  social_links?: Record<string, string> | null;
  shop_banner_url?: string | null;
  shop_accent_color?: string | null;
};
