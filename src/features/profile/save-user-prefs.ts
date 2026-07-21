import { isSupabaseConfigured } from '@/lib/supabase';
import { supabaseRpc } from '@/lib/supabase-rest';

export type SaveUserPrefsInput = {
  accessToken: string;
  homeZip: string;
  lng: number;
  lat: number;
  radiusMiles?: number;
  state?: string;
  city?: string;
};

export async function saveUserPrefsLocation(input: SaveUserPrefsInput): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
  }

  if (!input.accessToken) {
    throw new Error('Not signed in. Sign out and sign in again.');
  }

  const stateCode = input.state?.trim().toUpperCase() ?? null;

  await supabaseRpc(
    'upsert_user_prefs_location',
    {
      p_home_zip: input.homeZip,
      p_lng: input.lng,
      p_lat: input.lat,
      p_radius_miles: input.radiusMiles ?? 10,
      ...(stateCode && /^[A-Z]{2}$/.test(stateCode)
        ? { p_state: stateCode, p_city: input.city ?? null }
        : {}),
    },
    input.accessToken,
    15000
  );
}
