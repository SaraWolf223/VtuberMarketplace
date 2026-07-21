import { useShallow } from 'zustand/react/shallow';
import { useAppConfigStore } from '@/stores/app-config-store';

/**
 * Admin-configurable feed radius choices (`public_app_config.feed_radius_options`,
 * Phase 3 of the white-label plan) — replaces the old compile-time
 * `RADIUS_OPTIONS` constant in `src/types/enums.ts` (kept there as the
 * bundled fallback default).
 *
 * Filtered to `<= maxRadiusMiles` so a picker can never offer (or a stale
 * cached config can't leave behind) a value the `get_feed_listings` /
 * `upsert_user_prefs_location` RPCs will reject as `Invalid p_radius_miles`.
 *
 * Uses `useShallow` because the selector below derives a brand-new array
 * every call (`.filter()`/literal) — without it, zustand's `useSyncExternalStore`
 * sees a different reference on every render even when nothing changed,
 * which React flags as "getSnapshot should be cached" and can render-loop
 * infinitely (hit in practice on the desktop web feed sidebar).
 */
export function useRadiusOptions(): number[] {
  return useAppConfigStore(
    useShallow((s) => {
      const options = s.config.feedRadiusOptions.filter((n) => n <= s.config.maxRadiusMiles);
      return options.length > 0 ? options : [s.config.maxRadiusMiles];
    })
  );
}

/** Current admin-configured ceiling for feed/location radius, in miles. */
export function useMaxRadiusMiles(): number {
  return useAppConfigStore((s) => s.config.maxRadiusMiles);
}
