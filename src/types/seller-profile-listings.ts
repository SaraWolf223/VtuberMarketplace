import type { ListingCategory } from '@/types/enums';

export type SellerProfileListingItem = {
  id: string;
  title: string;
  price: number;
  category: ListingCategory;
  status: 'active' | 'sold';
  expires_at: string;
  published_at: string;
  boosted_until: string | null;
  thumb_path: string | null;
};
