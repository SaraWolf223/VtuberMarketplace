import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Analytics event names — see docs/19-Analytics_and_Growth.md */
export const AnalyticsEvents = {
  appOpened: 'app_opened',
  feedViewed: 'feed_viewed',
  listingViewed: 'listing_viewed',
  listingFavorited: 'listing_favorited',
  listingUnfavorited: 'listing_unfavorited',
  contactTapped: 'contact_tapped',
  reportSubmitted: 'report_submitted',
  signUpCompleted: 'sign_up_completed',
} as const;

type EventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

let posthogKey: string | undefined;
let analyticsDistinctId: string | undefined;

try {
  posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
} catch {
  posthogKey = undefined;
}

/** Call when auth session changes so events attach to the signed-in user. */
export function setAnalyticsDistinctId(userId: string | undefined): void {
  analyticsDistinctId = userId;
}

/**
 * Track product events. Logs in __DEV__; sends to PostHog when EXPO_PUBLIC_POSTHOG_KEY is set.
 */
export function trackEvent(
  name: EventName | string,
  props?: Record<string, string | number | boolean>
): void {
  const payload = {
    ...props,
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? 'unknown',
  };

  if (__DEV__) {
    console.log('[analytics]', name, payload);
  }

  if (!posthogKey) return;

  void fetch('https://us.i.posthog.com/capture/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: posthogKey,
      event: name,
      properties: {
        ...payload,
        $lib: 'localmarketplace-expo',
      },
      distinct_id: analyticsDistinctId ?? 'anonymous',
    }),
  }).catch(() => {
    /* non-blocking */
  });
}

/** @deprecated use trackEvent */
export function track(event: string, properties?: Record<string, unknown>): void {
  const props: Record<string, string | number | boolean> = {};
  if (properties) {
    for (const [k, v] of Object.entries(properties)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        props[k] = v;
      }
    }
  }
  trackEvent(event, props);
}
