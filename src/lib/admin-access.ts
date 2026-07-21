import type { Database } from '@/types/database';

export type StaffRole = Extract<Database['public']['Enums']['user_role'], 'admin' | 'manager'>;

export function isStaffRole(role: string | undefined | null): role is StaffRole {
  return role === 'admin' || role === 'manager';
}

export function isAdminRole(role: string | undefined | null): role is 'admin' {
  return role === 'admin';
}

export type AdminHubRoute =
  | '/admin/moderation'
  | '/admin/warned-users'
  | '/admin/banned-users'
  | '/admin/users'
  | '/admin/college-students'
  | '/admin/promo-codes'
  | '/admin/settings'
  | '/admin/banned-keywords'
  | '/admin/sla'
  | '/admin/waitlist'
  | '/admin/ios-waitlist'
  | '/admin/bulk-email'
  | '/admin/seed'
  | '/admin/branding'
  | '/admin/categories'
  | '/admin/email-templates'
  | '/admin/setup-status'
  | '/admin/security'
  | '/admin/bulletin'
  | '/admin/support';

/** Routes managers can access (moderation only). */
const MANAGER_ROUTES = new Set<AdminHubRoute>([
  '/admin/moderation',
  '/admin/warned-users',
  '/admin/banned-users',
  '/admin/banned-keywords',
  '/admin/users',
  '/admin/security',
  '/admin/bulletin',
  '/admin/support',
]);

export function canAccessAdminRoute(
  role: string | undefined | null,
  route: AdminHubRoute
): boolean {
  if (role === 'admin') return true;
  if (role === 'manager') return MANAGER_ROUTES.has(route);
  return false;
}

export function staffPanelTitle(role: string | undefined | null): string {
  return role === 'manager' ? 'Moderation panel' : 'Admin panel';
}
