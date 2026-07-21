import { useAppConfigStore } from '@/stores/app-config-store';

const LOGO_MARK = require('../../assets/logo-mark-trim.png');
const WEB_LOGO_LOCKUP = require('../../assets/web-logo-lockup.png');

type WebAssetModule = string | { uri: string; width?: number; height?: number };

function resolveWebAssetUri(source: WebAssetModule): string {
  if (typeof source === 'string') return source;
  if (source.uri) return source.uri;
  throw new Error('Could not resolve bundled web logo asset');
}

/** Square mark used on splash/loading screens. Remote override wins when set. */
export function useLogoMarkSource(): { uri: string } | number {
  const url = useAppConfigStore((s) => s.config.brandingLogoUrl);
  return url ? { uri: url } : LOGO_MARK;
}

/** Runtime white-label logo URL. Null means the bundled default should be used. */
export function useBrandLogoUrl(): string | null {
  return useAppConfigStore((s) => s.config.brandingLogoUrl);
}

/** Full wordmark used in the web shell header/auth. Remote override wins when set. */
export function useWebLogoLockupSource(): { uri: string } | number {
  const url = useAppConfigStore((s) => s.config.brandingLogoUrl);
  return url ? { uri: url } : WEB_LOGO_LOCKUP;
}

/** String URI form for plain `<img src>` on `.web.tsx` variants. */
export function useWebLogoLockupUri(): string {
  const url = useAppConfigStore((s) => s.config.brandingLogoUrl);
  return url ?? resolveWebAssetUri(WEB_LOGO_LOCKUP as WebAssetModule);
}
