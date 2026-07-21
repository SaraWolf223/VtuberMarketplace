/** Mirrors `supabase/functions/_shared/branding-image.ts` limits (client-side pre-check). */
export const BRANDING_LOGO_LIMITS = {
  MAX_BYTES: 1024 * 1024,
  MAX_WIDTH: 2048,
  MAX_HEIGHT: 2048,
};

export const BRANDING_LOGO_LIMITS_LABEL = 'PNG, JPEG, or WebP · up to 2048×2048px · 1MB';
