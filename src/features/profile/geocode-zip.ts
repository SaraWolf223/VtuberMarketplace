import { getSupabaseEnv } from '@/lib/supabase-rest';
import type { GeocodeResult } from '@/lib/mapbox-geocode';

export type { GeocodeResult };

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

const ZIP_RE = /^[0-9]{5}$/;

/** Geocode US ZIP via edge function only (rate-limited server-side). */
export async function geocodeZip(zipCode: string, accessToken: string): Promise<GeocodeResult> {
  const cleaned = zipCode.replace(/\D/g, '').slice(0, 5);
  if (!ZIP_RE.test(cleaned)) {
    throw new Error('Enter a valid 5-digit US ZIP code.');
  }

  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`${url}/functions/v1/geocode-zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ zip_code: cleaned }),
      signal: controller.signal,
    });

    const json = (await res.json()) as EdgeEnvelope<GeocodeResult>;

    if (json.ok && json.data) {
      return json.data;
    }

    throw new Error(json.error?.message ?? 'Geocoding failed');
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Geocoding timed out. Check your connection.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
