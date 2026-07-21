import type { Ionicons } from '@expo/vector-icons';

export type CategoryIconName = keyof typeof Ionicons.glyphMap;

/**
 * Fixed allowlist of Ionicons glyph names offered in the admin category
 * editor (`app/admin/categories.tsx`). Icon names are otherwise
 * free-form text in `listing_categories.icon_name` — this allowlist is
 * what keeps the picker to known-safe values and lets us validate/coerce
 * icon names client-side before ever rendering them.
 */
export const CATEGORY_ICON_ALLOWLIST: CategoryIconName[] = [
  'phone-portrait-outline',
  'game-controller-outline',
  'bed-outline',
  'shirt-outline',
  'man-outline',
  'woman-outline',
  'home-outline',
  'ribbon-outline',
  'cube-outline',
  'car-outline',
  'basketball-outline',
  'school-outline',
  'book-outline',
  'bicycle-outline',
  'color-palette-outline',
  'fast-food-outline',
  'people-outline',
  'brush-outline',
  'bag-handle-outline',
  'grid-outline',
  'paw-outline',
  'flower-outline',
  'construct-outline',
  'medkit-outline',
  'musical-notes-outline',
  'camera-outline',
  'watch-outline',
  'diamond-outline',
  'baseball-outline',
  'boat-outline',
  'airplane-outline',
  'gift-outline',
  'hammer-outline',
  'leaf-outline',
  'restaurant-outline',
  'shirt',
  'apps-outline',
];

export const DEFAULT_CATEGORY_ICON: CategoryIconName = 'grid-outline';

/** Coerce arbitrary text into a known-safe glyph name (never render free text as-is). */
export function toSafeCategoryIcon(name: string | null | undefined): CategoryIconName {
  return (CATEGORY_ICON_ALLOWLIST as string[]).includes(name ?? '')
    ? (name as CategoryIconName)
    : DEFAULT_CATEGORY_ICON;
}
