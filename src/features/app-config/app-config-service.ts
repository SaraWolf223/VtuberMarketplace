import { getSupabaseEnv } from '@/lib/supabase-rest';
import { appendUploadFile } from '@/lib/form-file';
import {
  parsePublicAppConfig,
  type PublicAppConfig,
  type BrandColorOverrides,
} from './app-config-types';

/**
 * Public, unauthenticated read of `public_app_config` — safe for the
 * sign-in screen and any pre-auth surface. RLS allows SELECT for `anon`.
 */
export async function fetchPublicAppConfig(timeoutMs = 8000): Promise<PublicAppConfig> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/rest/v1/public_app_config?select=key,value`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`app config request failed (${res.status})`);
    const rows = (await res.json()) as { key: string; value: unknown }[];
    return parsePublicAppConfig(rows);
  } finally {
    clearTimeout(timer);
  }
}

type EdgeEnvelope<T> = { ok: boolean; data: T | null; error: { message?: string } | null };

/** Admin-only: upload a new brand logo (validated server-side) and update config. */
export async function uploadBrandingLogo(
  accessToken: string,
  fileUri: string,
  mimeType: string
): Promise<string> {
  const { url, key } = getSupabaseEnv();
  const form = new FormData();
  await appendUploadFile(form, 'file', fileUri, 'logo.png', mimeType);

  const res = await fetch(`${url}/functions/v1/upload-branding-logo`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  const json = (await res.json()) as EdgeEnvelope<{ branding_logo_url: string }>;
  if (!json.ok || !json.data?.branding_logo_url) {
    throw new Error(json.error?.message ?? 'Logo upload failed');
  }
  return json.data.branding_logo_url;
}

const COLOR_KEYS: (keyof BrandColorOverrides)[] = ['primary', 'primaryDark', 'accent'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateColorOverrides(colors: BrandColorOverrides): void {
  for (const k of COLOR_KEYS) {
    const v = colors[k];
    if (v != null && !HEX_RE.test(v)) {
      throw new Error(`${k} must be a hex color like #0066FF`);
    }
  }
}

/** Admin-only: update the safe/public app config (colors, display name, radius, etc). */
export async function updatePublicAppConfig(
  accessToken: string,
  updates: {
    appDisplayName?: string;
    supportEmail?: string;
    brandingColors?: BrandColorOverrides;
    feedRadiusOptions?: number[];
    maxRadiusMiles?: number;
  }
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const rows: { key: string; value: unknown }[] = [];

  if (updates.appDisplayName != null) {
    const trimmed = updates.appDisplayName.trim();
    if (!trimmed) throw new Error('App display name cannot be empty');
    rows.push({ key: 'app_display_name', value: trimmed.slice(0, 60) });
  }
  if (updates.supportEmail != null) {
    const trimmed = updates.supportEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error('Enter a valid support email address');
    }
    rows.push({ key: 'support_email', value: trimmed.slice(0, 120) });
  }
  if (updates.brandingColors != null) {
    validateColorOverrides(updates.brandingColors);
    rows.push({ key: 'branding_colors', value: updates.brandingColors });
  }
  if (updates.maxRadiusMiles != null) {
    if (!Number.isFinite(updates.maxRadiusMiles) || updates.maxRadiusMiles <= 0 || updates.maxRadiusMiles > 200) {
      throw new Error('Max radius must be between 1 and 200 miles');
    }
    rows.push({ key: 'max_radius_miles', value: updates.maxRadiusMiles });
  }
  if (updates.feedRadiusOptions != null) {
    const opts = updates.feedRadiusOptions.filter((n) => Number.isFinite(n) && n > 0 && n <= 200).sort((a, b) => a - b);
    if (opts.length === 0) {
      throw new Error('Enter at least one valid radius option');
    }
    rows.push({ key: 'feed_radius_options', value: opts });
  }

  if (rows.length === 0) return;

  const res = await fetch(`${url}/rest/v1/public_app_config?on_conflict=key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }))),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Could not save app config (${res.status})`);
  }
}
