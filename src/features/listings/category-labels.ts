import type { LegacyListingCategory, ListingCategory } from '@/types/enums';
import { getCategories } from '@/stores/categories-store';
import { CATEGORY_LABELS } from '@/features/listings/category-static-labels';

export { CATEGORY_LABELS };

export function normalizeListingCategory(
  category: string | null | undefined
): ListingCategory | null {
  if (!category) return null;
  if (category === 'clothing') return 'miscellaneous';
  if (category in CATEGORY_LABELS) {
    return category as ListingCategory;
  }
  return 'miscellaneous';
}

/** Looks up admin-configured categories first (covers new/renamed categories
 *  not in the bundled default map), then falls back to the static labels. */
export function categoryLabel(category: LegacyListingCategory | string): string {
  const slug = category === 'clothing' ? 'miscellaneous' : category;
  const dynamic = getCategories().find((c) => c.slug === slug);
  if (dynamic) return dynamic.label;
  const normalized = normalizeListingCategory(category);
  return normalized ? CATEGORY_LABELS[normalized] : 'Miscellaneous';
}
