import { isBoostActive } from '@/utils/boost-countdown';
import { getThemeColors } from '@/theme/get-theme-colors';
import type { ViewStyle } from 'react-native';

export type ListingHighlightKind = 'none' | 'premium' | 'boost_free' | 'premium_boost';

export function getListingHighlightKind(listing: {
  boosted_until: string | null;
  seller_is_premium: boolean;
}): ListingHighlightKind {
  const boosted = isBoostActive(listing.boosted_until);
  const premium = listing.seller_is_premium;

  if (premium && boosted) return 'premium_boost';
  if (boosted) return 'boost_free';
  if (premium) return 'premium';
  return 'none';
}

const BORDER_WIDTH = 2;

export function listingHighlightBorderStyle(kind: ListingHighlightKind): ViewStyle {
  const colors = getThemeColors();
  switch (kind) {
    case 'premium_boost':
      return { borderColor: colors.highlightPremiumBoost, borderWidth: BORDER_WIDTH };
    case 'boost_free':
      return { borderColor: colors.highlightBoostFree, borderWidth: BORDER_WIDTH };
    case 'premium':
      return { borderColor: colors.highlightPremium, borderWidth: BORDER_WIDTH };
    default:
      return {};
  }
}
