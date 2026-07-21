import { create } from 'zustand';
import type { ListingCategory } from '@/types/enums';
import type { FeedSort } from '@/types/feed';

export type FeedMaxPrice = null | 5 | 10 | 20 | 35 | 50 | 100 | 250;
export type FeedMinPrice = null | number;
export type FeedListingStatus = 'active' | 'sold';

export type LicenseFilter = null | 'otu' | 'p2u';

type FeedFiltersState = {
  category: ListingCategory | null;
  minPrice: FeedMinPrice;
  maxPrice: FeedMaxPrice;
  sort: FeedSort;
  search: string;
  collegeStudentsOnly: boolean;
  listingStatus: FeedListingStatus;
  publishedAfter: string | null;
  publishedBefore: string | null;
  minSellerRating: number | null;
  licenseType: LicenseFilter;
  hasCustomization: boolean | null;
  hasSetup: boolean | null;
  setCategory: (category: ListingCategory | null) => void;
  setMinPrice: (minPrice: FeedMinPrice) => void;
  setMaxPrice: (maxPrice: FeedMaxPrice) => void;
  setSort: (sort: FeedSort) => void;
  setSearch: (search: string) => void;
  setCollegeStudentsOnly: (value: boolean) => void;
  setListingStatus: (status: FeedListingStatus) => void;
  setPublishedAfter: (iso: string | null) => void;
  setPublishedBefore: (iso: string | null) => void;
  setMinSellerRating: (rating: number | null) => void;
  setLicenseType: (licenseType: LicenseFilter) => void;
  setHasCustomization: (value: boolean | null) => void;
  setHasSetup: (value: boolean | null) => void;
  reset: () => void;
};

const initial = {
  category: null as ListingCategory | null,
  minPrice: null as FeedMinPrice,
  maxPrice: null as FeedMaxPrice,
  sort: 'newest' as FeedSort,
  search: '',
  collegeStudentsOnly: false,
  listingStatus: 'active' as FeedListingStatus,
  publishedAfter: null as string | null,
  publishedBefore: null as string | null,
  minSellerRating: null as number | null,
  licenseType: null as LicenseFilter,
  hasCustomization: null as boolean | null,
  hasSetup: null as boolean | null,
};

export const useFeedFiltersStore = create<FeedFiltersState>((set) => ({
  ...initial,
  setCategory: (category) => set({ category }),
  setMinPrice: (minPrice) => set({ minPrice }),
  setMaxPrice: (maxPrice) => set({ maxPrice }),
  setSort: (sort) => set({ sort }),
  setSearch: (search) => set({ search }),
  setCollegeStudentsOnly: (collegeStudentsOnly) => set({ collegeStudentsOnly }),
  setListingStatus: (listingStatus) => set({ listingStatus }),
  setPublishedAfter: (publishedAfter) => set({ publishedAfter }),
  setPublishedBefore: (publishedBefore) => set({ publishedBefore }),
  setMinSellerRating: (minSellerRating) => set({ minSellerRating }),
  setLicenseType: (licenseType) => set({ licenseType }),
  setHasCustomization: (hasCustomization) => set({ hasCustomization }),
  setHasSetup: (hasSetup) => set({ hasSetup }),
  reset: () => set({ ...initial }),
}));
