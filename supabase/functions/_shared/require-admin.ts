import { createSupabaseAdmin } from './supabaseAdmin.ts';
import { errorResponse } from './errors.ts';
import { requireUser, type AuthResult } from './auth.ts';

// supabase-js@2.49.1's auth.mfa.getAuthenticatorAssuranceLevel() takes NO jwt
// argument — it only ever reads the *calling client's own* in-memory session.
// createSupabaseAdmin() is a service-role client with no session, so calling
// it that way always resolved to currentLevel=null regardless of the caller's
// real AAL, meaning requireStaff rejected every admin/manager request with
// MFA_REQUIRED even when they had a genuine, fully-verified AAL2 session.
// requireUser() above already verified this JWT's signature via a real
// network call to Supabase Auth (getUser), so it's safe to decode the payload
// ourselves here purely to read the already-authenticated session's `aal`
// claim — this is independent of whichever supabase-js version is pinned.
function decodeJwtAal(jwt: string): string | null {
  try {
    const base64Url = jwt.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { aal?: unknown };
    return typeof payload.aal === 'string' ? payload.aal : null;
  } catch {
    return null;
  }
}

export type StaffAuthResult =
  | { user: { id: string }; authorization: string; role: 'admin' | 'manager' }
  | { response: Response };

export async function requireStaff(req: Request): Promise<StaffAuthResult> {
  const auth: AuthResult = await requireUser(req);
  if ('response' in auth) {
    return auth;
  }

  const admin = createSupabaseAdmin();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single();

  const role = profile?.role;
  if (error || (role !== 'admin' && role !== 'manager')) {
    return { response: errorResponse('Staff access required', 403, 'FORBIDDEN') };
  }

  // Admin/manager roles must complete TOTP step-up (aal2) — closes the gap where a
  // stolen staff session token alone could reach admin-only server actions.
  const jwt = auth.authorization.replace(/^Bearer\s+/i, '');
  const currentLevel = decodeJwtAal(jwt);
  if (currentLevel !== 'aal2') {
    return {
      response: errorResponse(
        'Two-factor authentication step-up required',
        403,
        'MFA_REQUIRED'
      ),
    };
  }

  return { user: auth.user, authorization: auth.authorization, role };
}

export type AdminAuthResult =
  | { user: { id: string }; authorization: string }
  | { response: Response };

export async function requireAdmin(req: Request): Promise<AdminAuthResult> {
  const staff = await requireStaff(req);
  if ('response' in staff) {
    return staff;
  }
  if (staff.role !== 'admin') {
    return { response: errorResponse('Admin access required', 403, 'FORBIDDEN') };
  }
  return { user: staff.user, authorization: staff.authorization };
}

/** Manager-allowed admin-action names (moderation only). */
export const MANAGER_ADMIN_ACTIONS = new Set<string>([
  'unpause_listing',
  'pause_listing',
  'delete_listing',
  'ban_user',
  'unban_user',
  'warn_user',
  'shadow_ban_user',
  'unshadow_ban_user',
  'dismiss_reports',
  'purge_orphan_reports',
]);

export function assertManagerActionAllowed(
  role: 'admin' | 'manager',
  action: string
): Response | null {
  if (role === 'admin') return null;
  if (MANAGER_ADMIN_ACTIONS.has(action)) return null;
  return errorResponse('This action requires admin access', 403, 'FORBIDDEN');
}
