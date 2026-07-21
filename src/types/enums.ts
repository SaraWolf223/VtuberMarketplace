export const LISTING_CATEGORIES = [
  'electronics',
  'gaming',
  'furniture',
  'womens_clothing',
  'mens_clothing',
  'home',
  'collectibles',
  'toys',
  'automotive',
  'sports_outdoors',
  'college_school',
  'books',
  'bikes',
  'decorations',
  'food_beverage',
  'carpool',
  'hobby',
  'delivery',
  'miscellaneous',
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

/** @deprecated DB legacy value — mapped to miscellaneous in queries */
export type LegacyListingCategory = ListingCategory | 'clothing';

/**
 * Bundled fallback used before the admin-configurable list
 * (`public_app_config.feed_radius_options`, see `useRadiusOptions()`) has
 * loaded, and as the default `options` for the helpers below.
 */
export const RADIUS_OPTIONS = [0.5, 1, 2, 5, 10, 25, 50] as const;
/** @deprecated Radius options are now admin-configurable — use `number` instead. Kept for compat. */
export type RadiusMiles = number;

export function isRadiusMiles(value: number, options: readonly number[] = RADIUS_OPTIONS): boolean {
  return options.includes(value);
}

export function parseRadiusMiles(value: unknown, options: readonly number[] = RADIUS_OPTIONS): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isRadiusMiles(n, options)) return n;
  return options.includes(10) ? 10 : (options[0] ?? 10);
}

export function formatRadiusLabel(miles: number): string {
  return miles === 0.5 ? '0.5 mi' : `${miles} mi`;
}
