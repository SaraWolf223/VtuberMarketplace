import { supabaseRestGet } from '@/lib/supabase-rest';
import type { Database } from '@/types/database';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'] & {
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  college_edu_email?: string | null;
  college_badge_verified_at?: string | null;
  college_badge_expires_at?: string | null;
  college_reverify_deadline_at?: string | null;
  stripe_customer_id?: string | null;
  is_founding_seller?: boolean;
  founding_seller_at?: string | null;
};

export async function fetchProfile(
  accessToken: string,
  userId: string
): Promise<ProfileRow> {
  const rows = await supabaseRestGet<ProfileRow>(
    `profiles?id=eq.${userId}&select=*`,
    accessToken,
    12000
  );

  if (!rows[0]) {
    throw new Error('Profile not found. Try signing out and back in.');
  }

  return rows[0];
}
