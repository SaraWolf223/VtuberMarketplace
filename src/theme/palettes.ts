export type ThemeMode = 'light' | 'dark';

export type ColorPalette = {
  primary: string;
  primaryDark: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  successMuted: string;
  successMutedText: string;
  warning: string;
  warningMuted: string;
  warningMutedText: string;
  error: string;
  errorMuted: string;
  errorMutedText: string;
  onPrimary: string;
  sold: string;
  price: string;
  priceBackground: string;
  premium: string;
  boost: string;
  highlightBoostFree: string;
  highlightPremium: string;
  highlightPremiumBoost: string;
  avatarRingAdmin: string;
  billGreen: string;
  billGreenMuted: string;
  billGold: string;
  tabBar: string;
  tabBarBorder: string;
};

/** Default — clean Silicon Valley light theme. */
export const lightColors: ColorPalette = {
  primary: '#0066FF',
  primaryDark: '#0052CC',
  accent: '#0066FF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0A0A0F',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  success: '#10B981',
  successMuted: '#DCFCE7',
  successMutedText: '#166534',
  warning: '#F59E0B',
  warningMuted: '#FEF3C7',
  warningMutedText: '#92400E',
  error: '#EF4444',
  errorMuted: '#FEE2E2',
  errorMutedText: '#991B1B',
  onPrimary: '#FFFFFF',
  sold: '#64748B',
  price: '#0066FF',
  priceBackground: '#EFF6FF',
  premium: '#1E40AF',
  boost: '#60A5FA',
  highlightBoostFree: '#93C5FD',
  highlightPremium: '#3B82F6',
  highlightPremiumBoost: '#1E3A8A',
  avatarRingAdmin: '#0066FF',
  billGreen: '#0066FF',
  billGreenMuted: '#EFF6FF',
  billGold: '#0066FF',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
};

/** Dark — black surfaces, electric blue accents. */
export const darkColors: ColorPalette = {
  primary: '#3385FF',
  primaryDark: '#0066FF',
  accent: '#3385FF',
  background: '#0A0A0F',
  surface: '#141419',
  surfaceElevated: '#1C1C24',
  border: '#2A2A35',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  success: '#34D399',
  successMuted: '#14532D',
  successMutedText: '#86EFAC',
  warning: '#FBBF24',
  warningMuted: '#422006',
  warningMutedText: '#FDE68A',
  error: '#F87171',
  errorMuted: '#450A0A',
  errorMutedText: '#FCA5A5',
  onPrimary: '#FFFFFF',
  sold: '#64748B',
  price: '#3385FF',
  priceBackground: '#1E3A5F',
  premium: '#60A5FA',
  boost: '#93C5FD',
  highlightBoostFree: '#93C5FD',
  highlightPremium: '#3B82F6',
  highlightPremiumBoost: '#1E40AF',
  avatarRingAdmin: '#3385FF',
  billGreen: '#3385FF',
  billGreenMuted: '#1E3A5F',
  billGold: '#3385FF',
  tabBar: '#141419',
  tabBarBorder: '#2A2A35',
};

/** Curated admin-editable brand tokens — see `BrandColorOverrides` in
 *  `src/features/app-config/app-config-types.ts`. Deliberately limited to
 *  brand accent colors, never structural background/surface/text tokens,
 *  so an admin's color choice can never break dark-mode contrast. */
export type BrandColorOverrides = Partial<Pick<ColorPalette, 'primary' | 'primaryDark' | 'accent'>>;

export function resolveThemeColors(mode: ThemeMode, overrides?: BrandColorOverrides): ColorPalette {
  const base = mode === 'dark' ? darkColors : lightColors;
  if (!overrides || Object.keys(overrides).length === 0) return base;
  return { ...base, ...overrides };
}
