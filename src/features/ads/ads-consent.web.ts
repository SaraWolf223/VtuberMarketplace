/** Ads (and therefore consent/ATT) are native-only; no-op on web. */
export function ensureMobileAdsReady(): Promise<void> {
  return Promise.resolve();
}
