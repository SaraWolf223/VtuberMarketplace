import type { User } from '@supabase/supabase-js';
import type { ProfileRow } from '@/features/profile/profile-service';

export function isEmailVerified(
  user: User | null | undefined,
  profile?: ProfileRow | null
): boolean {
  if (user?.email_confirmed_at) return true;
  const row = profile as (ProfileRow & { email_confirmed_at?: string | null }) | null | undefined;
  return row?.email_confirmed_at != null;
}
