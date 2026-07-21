import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export type WebNavItem = {
  href: '/(tabs)' | '/(tabs)/sell' | '/(tabs)/favorites' | '/(tabs)/notifications' | '/(tabs)/profile';
  label: string;
  icon: IconName;
  iconActive: IconName;
  /** Mirrors native tabBarAccessibilityLabel where useful. */
  accessibilityLabel: string;
};

/** Same destinations as the mobile bottom tab bar — rendered in the desktop top nav. */
export const WEB_NAV_ITEMS: WebNavItem[] = [
  {
    href: '/(tabs)',
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
    accessibilityLabel: 'Home feed',
  },
  {
    href: '/(tabs)/sell',
    label: 'Post ad',
    icon: 'cash-outline',
    iconActive: 'cash',
    accessibilityLabel: 'Post a listing',
  },
  {
    href: '/(tabs)/favorites',
    label: 'Saved',
    icon: 'heart-outline',
    iconActive: 'heart',
    accessibilityLabel: 'Saved listings',
  },
  {
    href: '/(tabs)/notifications',
    label: 'Activity',
    icon: 'notifications-outline',
    iconActive: 'notifications',
    accessibilityLabel: 'Activity and notifications',
  },
  {
    href: '/(tabs)/profile',
    label: 'Profile',
    icon: 'person-outline',
    iconActive: 'person',
    accessibilityLabel: 'Your profile',
  },
];

export function isWebNavActive(pathname: string, item: WebNavItem): boolean {
  if (item.href === '/(tabs)') {
    return pathname === '/' || pathname === '/index';
  }
  const segment = item.href.replace('/(tabs)', '');
  return pathname === segment || pathname.startsWith(`${segment}/`);
}

export function shouldShowWebTopBar(pathname: string, isSignedIn: boolean): boolean {
  if (!isSignedIn) return false;
  if (pathname.startsWith('/(auth)') || pathname === '/sign-in' || pathname === '/onboarding') {
    return false;
  }
  if (pathname === '/callback' || pathname.startsWith('/callback')) return false;
  if (pathname === '/marketing-capture') return false;
  if (pathname.startsWith('/legal')) return false;
  return true;
}
