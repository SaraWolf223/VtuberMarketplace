import { useCategoriesStore } from '@/stores/categories-store';
import { toSafeCategoryIcon, type CategoryIconName } from '@/constants/ionicons-allowlist';
import type { ListingCategory } from '@/types/enums';

export type ListingCategoryOption = {
  slug: ListingCategory;
  label: string;
  icon: CategoryIconName;
};

/**
 * Admin-configurable listing categories (see `listing_categories` table,
 * Phase 2 of the white-label plan) — replaces the old compile-time
 * `LISTING_CATEGORIES` constant as the source of truth for pickers/filters.
 * Falls back to the bundled defaults automatically via `useCategoriesStore`.
 */
export function useListingCategories(): ListingCategoryOption[] {
  const rows = useCategoriesStore((s) => s.categories);
  return rows.map((row) => ({
    slug: row.slug as ListingCategory,
    label: row.label,
    icon: toSafeCategoryIcon(row.icon_name),
  }));
}
