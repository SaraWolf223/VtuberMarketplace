import type { createSupabaseAdmin } from './supabaseAdmin.ts';
import { geocodeUsZip, type GeocodeData } from './mapbox.ts';

type AdminClient = ReturnType<typeof createSupabaseAdmin>;

export type ZipLookupResult =
  | { ok: true; data: GeocodeData }
  | { ok: false; code: 'GEO_CONFIG' | 'INVALID_ZIP'; message: string };

/**
 * Resolves a US ZIP to a lat/lng centroid, checking the zip_centroids cache
 * before ever calling Mapbox. Shared by geocode-zip and create-listing so a
 * ZIP only needs to be geocoded once across the whole app (saves Mapbox
 * quota and avoids duplicate network round-trips on listing creation).
 */
export async function resolveZipCentroid(
  admin: AdminClient,
  zip: string,
  mapboxToken: string | undefined
): Promise<ZipLookupResult> {
  const { data: cached } = await admin
    .from('zip_centroids')
    .select('lat, lng, city, state')
    .eq('zip_code', zip)
    .maybeSingle();

  if (cached) {
    return {
      ok: true,
      data: { lat: cached.lat, lng: cached.lng, city: cached.city ?? '', state: cached.state ?? '' },
    };
  }

  if (!mapboxToken) {
    return { ok: false, code: 'GEO_CONFIG', message: 'MAPBOX_ACCESS_TOKEN is not configured' };
  }

  const geocoded = await geocodeUsZip(zip, mapboxToken);
  if (!geocoded) {
    return { ok: false, code: 'INVALID_ZIP', message: 'That ZIP could not be found. Try another US ZIP.' };
  }

  const { error: upsertError } = await admin.from('zip_centroids').upsert({
    zip_code: zip,
    lat: geocoded.lat,
    lng: geocoded.lng,
    city: geocoded.city,
    state: geocoded.state,
    updated_at: new Date().toISOString(),
  });
  if (upsertError) {
    console.error('zip_centroids upsert', upsertError.message);
  }

  return { ok: true, data: geocoded };
}
