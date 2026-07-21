import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export async function getPlatformSettingInt(
  admin: SupabaseClient,
  key: string,
  defaultValue: number
): Promise<number> {
  const { data } = await admin.from('platform_settings').select('value').eq('key', key).maybeSingle();
  if (!data?.value) return defaultValue;
  const raw = data.value;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

export async function getBoostDurationHours(admin: SupabaseClient): Promise<number> {
  const hours = await getPlatformSettingInt(admin, 'boost_duration_hours', 24);
  return Math.max(1, Math.min(hours, 168));
}

export async function getBoostBaseCents(admin: SupabaseClient): Promise<number> {
  const cents = await getPlatformSettingInt(admin, 'boost_base_cents', 100);
  return Math.max(50, Math.min(cents, 2000));
}

export type PlatformSettingsMap = Record<string, number>;

export async function fetchPlatformSettings(admin: SupabaseClient): Promise<PlatformSettingsMap> {
  const { data, error } = await admin.from('platform_settings').select('key, value');
  if (error) throw error;
  const out: PlatformSettingsMap = {};
  for (const row of data ?? []) {
    out[row.key] = await getPlatformSettingInt(admin, row.key, 0);
  }
  return out;
}

// Per-key [min, max] bounds. Writes are clamped so a bad admin input can't set
// negative/absurd prices or limits (mirrors the read-side clamps above).
const SETTING_BOUNDS: Record<string, [number, number]> = {
  boost_duration_hours: [1, 168],
  boost_base_cents: [50, 2000],
  reports_per_hour: [1, 100],
  pause_reports_24h: [1, 500],
  pause_reports_lifetime: [1, 5000],
};

export async function upsertPlatformSettings(
  admin: SupabaseClient,
  updates: Record<string, number>
): Promise<void> {
  for (const [key, rawValue] of Object.entries(updates)) {
    const bounds = SETTING_BOUNDS[key];
    if (!bounds || !Number.isFinite(rawValue)) continue;
    const [min, max] = bounds;
    const value = Math.min(Math.max(Math.round(rawValue), min), max);
    const { error } = await admin.from('platform_settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}
