import type { BrandColorOverrides } from '@/theme/palettes';
import { BUILD_APP_IDENTITY } from '@/config/app-identity';

export type { BrandColorOverrides };

export type PublicAppConfig = {
  appDisplayName: string;
  supportEmail: string;
  brandingLogoUrl: string | null;
  brandingColors: BrandColorOverrides;
  feedRadiusOptions: number[];
  maxRadiusMiles: number;
  platformFeePercentFree: number;
  platformFeePercentPro: number;
  featuredPlacementDurationDays: number;
  featuredPlacementPriceCents: number;
};

export const DEFAULT_PUBLIC_APP_CONFIG: PublicAppConfig = {
  appDisplayName: BUILD_APP_IDENTITY.appDisplayName,
  supportEmail: BUILD_APP_IDENTITY.supportEmail,
  brandingLogoUrl: null,
  brandingColors: {},
  feedRadiusOptions: [0.5, 1, 2, 5, 10, 25, 50],
  maxRadiusMiles: 50,
  platformFeePercentFree: 0.1,
  platformFeePercentPro: 0.08,
  featuredPlacementDurationDays: 7,
  featuredPlacementPriceCents: 500,
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeColor(value: unknown): string | undefined {
  return typeof value === 'string' && HEX_COLOR_RE.test(value) ? value : undefined;
}

function sanitizeColorOverrides(value: unknown): BrandColorOverrides {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const out: BrandColorOverrides = {};
  const primary = sanitizeColor(raw.primary);
  const primaryDark = sanitizeColor(raw.primaryDark);
  const accent = sanitizeColor(raw.accent);
  if (primary) out.primary = primary;
  if (primaryDark) out.primaryDark = primaryDark;
  if (accent) out.accent = accent;
  return out;
}

function sanitizeRadiusOptions(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_PUBLIC_APP_CONFIG.feedRadiusOptions;
  const nums = value
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 200)
    .sort((a, b) => a - b);
  return nums.length > 0 ? nums : DEFAULT_PUBLIC_APP_CONFIG.feedRadiusOptions;
}

function sanitizeMaxRadius(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 && n <= 200 ? n : DEFAULT_PUBLIC_APP_CONFIG.maxRadiusMiles;
}

function sanitizeString(value: unknown, fallback: string, maxLen: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed || fallback;
}

function sanitizeBps(value: unknown, fallbackPercent: number): number {
  const raw = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(raw) || raw <= 0) return fallbackPercent;
  return raw / 10_000;
}

function sanitizePositiveInt(value: unknown, fallback: number, max: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

/** Parse `public_app_config` rows (key/value JSONB) into a typed, sanitized config. */
export function parsePublicAppConfig(rows: { key: string; value: unknown }[]): PublicAppConfig {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    appDisplayName: sanitizeString(
      map.get('app_display_name'),
      DEFAULT_PUBLIC_APP_CONFIG.appDisplayName,
      60
    ),
    supportEmail: sanitizeString(
      map.get('support_email'),
      DEFAULT_PUBLIC_APP_CONFIG.supportEmail,
      120
    ),
    brandingLogoUrl:
      typeof map.get('branding_logo_url') === 'string' ? (map.get('branding_logo_url') as string) : null,
    brandingColors: sanitizeColorOverrides(map.get('branding_colors')),
    feedRadiusOptions: sanitizeRadiusOptions(map.get('feed_radius_options')),
    maxRadiusMiles: sanitizeMaxRadius(map.get('max_radius_miles')),
    platformFeePercentFree: sanitizeBps(
      map.get('platform_fee_bps_free'),
      DEFAULT_PUBLIC_APP_CONFIG.platformFeePercentFree
    ),
    platformFeePercentPro: sanitizeBps(
      map.get('platform_fee_bps_pro'),
      DEFAULT_PUBLIC_APP_CONFIG.platformFeePercentPro
    ),
    featuredPlacementDurationDays: sanitizePositiveInt(
      map.get('featured_placement_duration_days'),
      DEFAULT_PUBLIC_APP_CONFIG.featuredPlacementDurationDays,
      90
    ),
    featuredPlacementPriceCents: sanitizePositiveInt(
      map.get('featured_placement_price_cents'),
      DEFAULT_PUBLIC_APP_CONFIG.featuredPlacementPriceCents,
      100_000
    ),
  };
}
