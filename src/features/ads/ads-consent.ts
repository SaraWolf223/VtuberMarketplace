import { Platform } from 'react-native';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { isMobileAdsNativeLinked } from '@/lib/mobile-ads';

/**
 * Centralized AdMob readiness gate. Every native ad path funnels through
 * `ensureMobileAdsReady()` so the required privacy prompts happen IN ORDER
 * and exactly once, before any ad is requested:
 *
 *   1. iOS App Tracking Transparency (ATT) prompt
 *   2. Google UMP consent form (EEA/UK — auto no-ops elsewhere)
 *   3. Mobile Ads SDK initialize()
 *
 * Memoized: the work runs a single time per app launch; concurrent callers
 * share the same promise. No-ops (resolves immediately) when the native module
 * isn't linked (Expo Go / pre-rebuild) — and the whole file is web-stubbed.
 */

let readyPromise: Promise<void> | null = null;

async function requestAttIfIOS(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } = await import(
      'expo-tracking-transparency'
    );
    const current = await getTrackingPermissionsAsync();
    // Only prompt while still undetermined; iOS shows the system dialog once.
    if (current.status === 'undetermined' && current.canAskAgain) {
      await requestTrackingPermissionsAsync();
    }
  } catch {
    // ATT unavailable or denied — ads still serve (non-personalized).
  }
}

async function gatherUmpConsent(): Promise<void> {
  try {
    await AdsConsent.requestInfoUpdate();
    // Shows the consent form only when UMP says it's required (e.g. EEA/UK).
    await AdsConsent.loadAndShowConsentFormIfRequired();
  } catch {
    // Consent flow failed — Google falls back to non-personalized ads.
  }
}

export function ensureMobileAdsReady(): Promise<void> {
  if (!isMobileAdsNativeLinked()) return Promise.resolve();
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    await requestAttIfIOS();
    await gatherUmpConsent();
    try {
      await mobileAds().initialize();
    } catch {
      // initialize() rarely rejects; individual ad requests will retry.
    }
  })();

  return readyPromise;
}
