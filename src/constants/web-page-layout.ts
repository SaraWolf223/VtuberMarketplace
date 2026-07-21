/** Light gray shell behind the white content column (Marketplace-style desktop web). */
export const WEB_DESKTOP_CHROME_BG = '#f0f2f5';

/** Width of settings left sidebar on desktop web. */
export const WEB_SETTINGS_SIDEBAR_WIDTH = 260;

/** Width of Activity / Profile slide-over panel from the right. */
export const WEB_RIGHT_PANEL_WIDTH = 440;

export const WEB_PROFILE_ACTIVITY_NAV: { href: string; label: string; match: string }[] = [
  { href: '/(tabs)/notifications', label: 'Activity', match: '/notifications' },
  { href: '/(tabs)/profile', label: 'Profile', match: '/profile' },
];

export function isProfileActivityNavActive(pathname: string, match: string): boolean {
  return pathname === match || pathname.startsWith(`${match}/`);
}

export const WEB_SETTINGS_NAV: { href: string; label: string }[] = [
  { href: '/settings', label: 'Account' },
  { href: '/settings/location', label: 'Your location' },
  { href: '/settings/premium', label: 'Premium' },
  { href: '/settings/safety', label: 'Safety' },
  { href: '/settings/blocked-users', label: 'Blocked users' },
  { href: '/settings/legal', label: 'Legal' },
  { href: '/settings/verify-phone', label: 'Verify phone' },
  { href: '/settings/verify-college-email', label: 'College badge' },
  { href: '/settings/redeem-promo', label: 'Redeem promo' },
  { href: '/settings/security', label: 'Two-factor authentication' },
];

export function getSettingsPageTitle(pathname: string): string | null {
  if (pathname === '/settings' || pathname === '/settings/') return 'Account';
  const item = WEB_SETTINGS_NAV.find(
    (nav) => nav.href !== '/settings' && (pathname === nav.href || pathname.startsWith(`${nav.href}/`))
  );
  return item?.label ?? null;
}
