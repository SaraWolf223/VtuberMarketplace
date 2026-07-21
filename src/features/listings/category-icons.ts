import type { ListingCategory } from '@/types/enums';
import type { CategoryIconName } from '@/constants/ionicons-allowlist';

export type { CategoryIconName };

/** Short labels for compact filter grid tiles */
export const CATEGORY_FILTER_LABELS: Record<ListingCategory, string> = {
  electronics: 'Electronics',
  gaming: 'Gaming',
  furniture: 'Furniture',
  womens_clothing: "Women's",
  mens_clothing: "Men's",
  home: 'Home',
  collectibles: 'Collectibles',
  toys: 'Toys',
  automotive: 'Auto',
  sports_outdoors: 'Sports',
  college_school: 'School',
  books: 'Books',
  bikes: 'Bikes',
  decorations: 'Decor',
  food_beverage: 'Food',
  carpool: 'Carpool',
  hobby: 'Hobby',
  delivery: 'Delivery',
  miscellaneous: 'Other',
};

export const CATEGORY_ICONS: Record<ListingCategory, CategoryIconName> = {
  electronics: 'phone-portrait-outline',
  gaming: 'game-controller-outline',
  furniture: 'bed-outline',
  womens_clothing: 'shirt-outline',
  mens_clothing: 'man-outline',
  home: 'home-outline',
  collectibles: 'ribbon-outline',
  toys: 'cube-outline',
  automotive: 'car-outline',
  sports_outdoors: 'basketball-outline',
  college_school: 'school-outline',
  books: 'book-outline',
  bikes: 'bicycle-outline',
  decorations: 'color-palette-outline',
  food_beverage: 'fast-food-outline',
  carpool: 'people-outline',
  hobby: 'brush-outline',
  delivery: 'bag-handle-outline',
  miscellaneous: 'grid-outline',
};

export const ALL_CATEGORIES_ICON: CategoryIconName = 'apps-outline';
