import type { ListingCategory } from '@/types/enums';

/**
 * Raw static label map — intentionally has zero imports beyond types so it
 * can be safely imported by both `category-labels.ts` and
 * `stores/categories-store.ts` without creating a module cycle between them
 * (categories-store needs this data at module-init time to build its bundled
 * defaults; category-labels needs a function from categories-store, which
 * previously created a circular import and a "Cannot access before
 * initialization" crash depending on which module loaded first).
 */
export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  electronics: 'Electronics',
  gaming: 'Gaming',
  furniture: 'Furniture',
  womens_clothing: "Women's clothing",
  mens_clothing: "Men's clothing",
  home: 'Home',
  collectibles: 'Collectibles',
  toys: 'Toys',
  automotive: 'Automotive',
  sports_outdoors: 'Sports & outdoors',
  college_school: 'College / school',
  books: 'Books',
  bikes: 'Bikes',
  decorations: 'Decorations',
  food_beverage: 'Food & beverage',
  carpool: 'Carpool',
  hobby: 'Hobby',
  delivery: 'Delivery',
  miscellaneous: 'Miscellaneous',
};
