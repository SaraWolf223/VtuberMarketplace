/**
 * Shared gate for full-screen ads (App Open + Interstitial).
 *
 * Both managers consult this before showing so the two formats never stack,
 * a global minimum gap is always honored, and sensitive screens (auth,
 * onboarding, checkout, etc.) can hard-suppress full-screen ads.
 *
 * Pure module state — no native imports — so it's safe on web and in builds
 * that predate the AdMob native module.
 */
import { FULLSCREEN_AD_MIN_GAP_MS } from '@/constants/fullscreen-ads';

let lastShownAt = 0;
let showing = false;
let suppressionCount = 0;

/** Record that a full-screen ad was just shown (call on CLOSED). */
export function markFullScreenAdShown(): void {
  lastShownAt = Date.now();
}

/** Track whether a full-screen ad is currently on screen. */
export function setFullScreenAdShowing(value: boolean): void {
  showing = value;
}

export function isFullScreenAdShowing(): boolean {
  return showing;
}

/**
 * Suppress full-screen ads while on a sensitive screen. Returns a release
 * function; suppression is reference-counted so overlapping screens behave.
 */
export function suppressFullScreenAds(): () => void {
  suppressionCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressionCount = Math.max(0, suppressionCount - 1);
  };
}

export function areFullScreenAdsSuppressed(): boolean {
  return suppressionCount > 0;
}

/** Common eligibility shared by both ad formats. */
export function canShowFullScreenAd(): boolean {
  if (suppressionCount > 0) return false;
  if (showing) return false;
  if (Date.now() - lastShownAt < FULLSCREEN_AD_MIN_GAP_MS) return false;
  return true;
}
