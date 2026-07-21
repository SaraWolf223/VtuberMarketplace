import { useEffect, type ReactNode } from 'react';
import { fetchPublicAppConfig } from '@/features/app-config/app-config-service';
import { useAppConfigStore } from '@/stores/app-config-store';
import { fetchListingCategories } from '@/features/listings/categories-service';
import { useCategoriesStore } from '@/stores/categories-store';

/**
 * Fetches the buyer's public app config (branding, radius options, listing
 * categories, etc) once at startup and populates the config/categories
 * stores. Renders children immediately with the persisted/bundled defaults
 * — never blocks on the network — and silently keeps the cached values if
 * the fetch fails (offline-safe).
 */
export function AppConfigProvider({ children }: { children: ReactNode }): React.JSX.Element {
  useEffect(() => {
    let mounted = true;
    fetchPublicAppConfig()
      .then((config) => {
        if (mounted) useAppConfigStore.getState().setConfig(config);
      })
      .catch(() => {
        /* keep persisted/bundled defaults */
      });
    fetchListingCategories()
      .then((rows) => {
        if (mounted && rows.length > 0) useCategoriesStore.getState().setCategories(rows);
      })
      .catch(() => {
        /* keep persisted/bundled defaults */
      });
    return () => {
      mounted = false;
    };
  }, []);

  return children as React.JSX.Element;
}
