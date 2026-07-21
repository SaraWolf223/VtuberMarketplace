export type GeocodeData = {
  lat: number;
  lng: number;
  city: string;
  state: string;
};

type MapboxFeature = {
  center?: number[];
  text?: string;
  place_name?: string;
  properties?: { postcode?: string };
  context?: Array<{ id?: string; text?: string; short_code?: string }>;
};

function zipFromFeature(feature: MapboxFeature, zip: string): boolean {
  const candidates: (string | undefined)[] = [
    feature.properties?.postcode,
    feature.text,
    feature.place_name?.match(/\b(\d{5})\b/)?.[1],
    // Some place/region features carry the ZIP only in their context chain.
    ...(feature.context ?? [])
      .filter((c) => typeof c.id === 'string' && c.id.startsWith('postcode'))
      .map((c) => c.text),
  ];
  return candidates.some(
    (raw) => typeof raw === 'string' && raw.replace(/\D/g, '').slice(0, 5) === zip
  );
}

function parseFeature(feature: MapboxFeature): GeocodeData | null {
  const center = feature.center;
  if (!Array.isArray(center) || center.length < 2) return null;

  const lng = Number(center[0]);
  const lat = Number(center[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let city = '';
  let state = '';
  for (const ctx of feature.context ?? []) {
    if (typeof ctx.id === 'string' && ctx.id.startsWith('place')) {
      city = ctx.text ?? city;
    }
    if (typeof ctx.id === 'string' && ctx.id.startsWith('region')) {
      const code = ctx.short_code ?? '';
      state = code.replace(/^US-/, '') || (ctx.text ?? state);
    }
  }

  return { lat, lng, city, state };
}

async function queryMapbox(
  zip: string,
  token: string,
  types?: string
): Promise<MapboxFeature[]> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zip)}.json`
  );
  url.searchParams.set('country', 'US');
  url.searchParams.set('limit', '5');
  url.searchParams.set('access_token', token);
  if (types) url.searchParams.set('types', types);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error('Mapbox HTTP', res.status, await res.text());
    return [];
  }

  const json = await res.json();
  return (json.features ?? []) as MapboxFeature[];
}

export async function geocodeUsZip(zip: string, token: string): Promise<GeocodeData | null> {
  const attempts: (string | undefined)[] = ['postcode', 'postcode,place', undefined];

  for (const types of attempts) {
    const features = await queryMapbox(zip, token, types);
    // Only accept a feature whose postcode actually matches the requested ZIP.
    // Falling back to features[0] caused impossible ZIPs (e.g. 00000) to
    // fuzzy-match an arbitrary place instead of being rejected.
    const match = features.find((f) => zipFromFeature(f, zip));
    const parsed = match ? parseFeature(match) : null;
    if (parsed) return parsed;
  }

  return null;
}
