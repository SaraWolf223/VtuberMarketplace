import { isPremiumActive } from '@/features/monetization/premium-service';
import { getThemeColors } from '@/theme/get-theme-colors';

export type AvatarRingVariant = 'none' | 'premium' | 'admin';

const RING_WIDTH = 3;

export function resolveAvatarRingVariant(opts: {
  isAdmin?: boolean;
  isPremium?: boolean;
  premiumUntil?: string | null;
}): AvatarRingVariant {
  if (opts.isAdmin) return 'admin';
  if (opts.isPremium && isPremiumActive(opts.isPremium, opts.premiumUntil)) return 'premium';
  if (opts.isPremium) return 'premium';
  return 'none';
}

export function avatarRingColor(variant: AvatarRingVariant): string | undefined {
  const colors = getThemeColors();
  switch (variant) {
    case 'admin':
      return colors.avatarRingAdmin;
    case 'premium':
      return colors.highlightPremium;
    default:
      return undefined;
  }
}

export const AVATAR_RING_WIDTH = RING_WIDTH;
