/**
 * Full-screen ad pacing (App Open + Interstitial), tuned to stay within
 * AdMob policy and Google Play's "Better ad experiences" rules:
 *
 * - App Open ads show only when the user switches BACK into the app after being
 *   away (never on cold start / splash — that is a policy violation).
 * - Interstitials show only at logical content breaks (leaving a listing after
 *   browsing several), never on every back-press, with frequency capping.
 * - The two formats never stack, and a global gap is enforced between any two
 *   full-screen ads.
 *
 * These are intentionally conservative; raise/lower after reviewing fill +
 * retention once the AdMob account is live.
 */

/** Minimum gap between ANY two full-screen ads (app open OR interstitial). */
export const FULLSCREEN_AD_MIN_GAP_MS = 60_000;

/** App Open: do not show again within this window after a successful show. */
export const APP_OPEN_AD_COOLDOWN_MS = 4 * 60_000;

/**
 * App Open: ignore quick app switches shorter than this (e.g. flipping out to
 * copy an address or accept a permission dialog) so brief returns aren't ad-spammed.
 */
export const APP_OPEN_MIN_BACKGROUND_MS = 30_000;

/** App Open: AdMob app-open ads expire ~4h after load; refetch past this age. */
export const APP_OPEN_AD_MAX_AGE_MS = 4 * 60 * 60_000;

/** Interstitial: only after the user has viewed at least this many listings. */
export const INTERSTITIAL_AFTER_LISTING_VIEWS = 4;

/** Interstitial: do not show more often than this. */
export const INTERSTITIAL_COOLDOWN_MS = 4 * 60_000;
