import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getPersistStorage } from '@/lib/persist-storage';
import { LISTING_CATEGORIES } from '@/types/enums';
import { CATEGORY_LABELS } from '@/features/listings/category-static-labels';
import { CATEGORY_ICONS } from '@/features/listings/category-icons';
import type { ListingCategoryRow } from '@/features/listings/categories-service';

const BUNDLED_DEFAULT_CATEGORIES: ListingCategoryRow[] = LISTING_CATEGORIES.map((slug, i) => ({
  slug,
  label: CATEGORY_LABELS[slug],
  icon_name: CATEGORY_ICONS[slug],
  sort_order: i * 10,
  is_active: true,
}));

type CategoriesState = {
  categories: ListingCategoryRow[];
  setCategories: (categories: ListingCategoryRow[]) => void;
};

/** Persisted cache of admin-configured listing categories (see Phase 2 white-label plan). */
export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set) => ({
      categories: BUNDLED_DEFAULT_CATEGORIES,
      setCategories: (categories) => set({ categories: categories.length > 0 ? categories : BUNDLED_DEFAULT_CATEGORIES }),
    }),
    {
      name: 'localmarketplace-categories',
      storage: createJSONStorage(() => getPersistStorage()),
    }
  )
);

export function getCategories(): ListingCategoryRow[] {
  return useCategoriesStore.getState().categories;
}
