import type { ProfileRow } from '@/features/profile/profile-service';

export function isPhoneVerified(profile: ProfileRow | undefined | null): boolean {
  if (!profile) return false;
  const row = profile as ProfileRow & { phone_verified_at?: string | null };
  return row.phone_verified_at != null;
}
