import type { QueryClient } from '@tanstack/react-query';
import { supabaseRestGet } from '@/lib/supabase-rest';
import { queryKeys } from '@/lib/query-keys';
import { usePrefsStore } from '@/stores/prefs-store';
import { geocodeZip, type GeocodeResult } from '@/features/profile/geocode-zip';
import { saveUserPrefsLocation } from '@/features/profile/save-user-prefs';
import { hydrateCollegeFeedFilter } from '@/features/college/college-prefs-service';
import { normalizeUsStateCode } from '@/lib/us-state';
type RadiusMiles = number;

export type UserPrefsRow = {
  home_zip: string;
  radius_miles: RadiusMiles;
  feed_college_students_only?: boolean;
};

export async function fetchUserPrefs(
  userId: string,
  accessToken: string
): Promise<UserPrefsRow | null> {
  const rows = await supabaseRestGet<UserPrefsRow>(
    `user_prefs?user_id=eq.${userId}&select=home_zip,radius_miles,feed_college_students_only`,
    accessToken,
    10000
  );
  return rows[0] ?? null;
}

export function hydratePrefsStore(prefs: UserPrefsRow): void {
  usePrefsStore.getState().setHomeZip(prefs.home_zip);
  // Value comes straight from the server (already validated against the
  // admin-configured max_radius_miles by the RPC layer) — don't re-clamp
  // against the bundled RADIUS_OPTIONS fallback here.
  usePrefsStore.getState().setRadiusMiles(prefs.radius_miles);
  hydrateCollegeFeedFilter(!!prefs.feed_college_students_only);
}

export function hydratePrefsLocation(lat: number, lng: number): void {
  usePrefsStore.getState().setHomeLocation(lat, lng);
}

export async function saveLocationPrefs(input: {
  accessToken: string;
  homeZip: string;
  radiusMiles: RadiusMiles;
}): Promise<GeocodeResult> {
  const geo = await geocodeZip(input.homeZip, input.accessToken);

  await saveUserPrefsLocation({
    accessToken: input.accessToken,
    homeZip: input.homeZip.replace(/\D/g, '').slice(0, 5),
    lng: geo.lng,
    lat: geo.lat,
    radiusMiles: input.radiusMiles,
    state: geo.state,
    city: geo.city,
  });

  const homeState = normalizeUsStateCode(geo.state) ?? '';
  hydratePrefsStore({
    home_zip: input.homeZip.replace(/\D/g, '').slice(0, 5),
    radius_miles: input.radiusMiles,
  });
  usePrefsStore.getState().setHomeState(homeState);
  hydratePrefsLocation(geo.lat, geo.lng);

  return geo;
}

export function invalidateFeedQueries(queryClient: QueryClient, userId?: string): void {
  queryClient.invalidateQueries({ queryKey: ['feed'] });
  if (userId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.userPrefs(userId) });
  }
}
