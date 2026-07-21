# Full-screen ads — App Open + Interstitial (OfferUp-style)

Adds the two AdMob full-screen formats that give the OfferUp "video pops up, then
you can skip" experience, **without** touching the existing in-feed
native video ads (`FeedGoogleVideoAd`, etc.).

## What ships

| Format | When it shows | Why it's compliant |
|--------|---------------|--------------------|
| **App Open** | User switches **back into the app** after being away ≥ 30s | Google explicitly recommends App Open ads for app re-entry; never fires on cold start / splash |
| **Interstitial** | User **leaves a listing** after browsing several (≥ 4 views), capped to ~once per 4 min | Shown at a logical content break, never on every back-press |

> ⚠️ **Why not "interstitial on every back-press"?** AdMob policy forbids
> triggering an interstitial on the back button / every user action — it causes
> accidental clicks and is a top cause of **AdMob account suspension**. The
> capped browse-break + App Open combo gives the same feel safely.

Both formats:

- **Never stack** and honor a global minimum gap (`fullscreen-ad-gate.ts`).
- Can be **suppressed** on sensitive screens via `suppressFullScreenAds()`.
- **Pre-load** so they don't pop in late.
- **No-op** until the native module is linked AND `EXPO_PUBLIC_FULLSCREEN_ADS_LIVE=true`
  — so this is inert in Expo Go / web / current dev builds until the next EAS rebuild.

## Files

| File | Role |
|------|------|
| `src/constants/fullscreen-ads.ts` | Cooldowns / caps |
| `src/lib/mobile-ads.ts` | Ad-unit getters + `shouldServeFullScreenAds()` (additive) |
| `src/features/ads/fullscreen-ad-gate.ts` | Shared anti-stack / cooldown / suppression |
| `src/features/ads/app-open-ad.ts` (+ `.web.ts`) | App Open controller |
| `src/features/ads/interstitial-ad.ts` (+ `.web.ts`) | Interstitial controller |
| `src/providers/AppOpenAdBridge.tsx` | AppState foreground trigger (mounted in `app/_layout.tsx`) |
| `src/hooks/useBrowseInterstitial.ts` | Listing-detail logical-break trigger |

## Going live

1. Create **App Open** and **Interstitial** ad units in [AdMob](https://admob.google.com) for both the Android and iOS apps under your own AdMob account.
2. Put the App IDs (`ca-app-pub-…~…`) in `app.config.ts` (`react-native-google-mobile-ads` plugin).
3. Set in `.env` / EAS secrets (use Google test units until your AdMob account is approved; set flags `EXPO_PUBLIC_FULLSCREEN_ADS_LIVE=true`, `EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_LIVE=true` when going live):
   - `EXPO_PUBLIC_ADMOB_IOS_APP_OPEN_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_APP_OPEN_ID`
   - `EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID`
4. **Rebuild natively** (EAS dev/preview build) — full-screen ads do not work in Expo Go.
5. **UMP consent** + iOS **ATT** implemented in [src/features/ads/ads-consent.ts](../src/features/ads/ads-consent.ts) — every native ad path calls `ensureMobileAdsReady()` (ATT → UMP form → SDK init, once per launch). `expo-tracking-transparency` added; ATT string set via its config plugin.
6. Android: in Play Console declare **"app contains ads"**.

### Consent / ATT flow (`ensureMobileAdsReady()`)

All native ad entry points — feed banner, feed native video, App Open, Interstitial — await this single memoized gate before requesting an ad, guaranteeing order + a single run per launch:

1. **iOS ATT** — `expo-tracking-transparency` prompt (only while status is `undetermined`).
2. **UMP consent** — `AdsConsent.requestInfoUpdate()` + `loadAndShowConsentFormIfRequired()` (auto-shows only where required, e.g. EEA/UK; no-op in the US).
3. **`mobileAds().initialize()`**.

Failures at any step fall back to non-personalized ads rather than blocking. Web is stubbed (`ads-consent.web.ts`).

In development, leaving the production unit IDs unset uses Google **test** units automatically when the flag is on + the app is rebuilt.

## iOS

Fully supported — `react-native-google-mobile-ads` serves both formats on iOS and
Android. iOS additionally needs the **ATT** prompt + **UMP** consent before
requesting ads in production. Ads themselves do not conflict with the iOS IAP
decision (see 10-Monetization_System.md §2), which is only about paid features.

## Compliance checklist

- No full-screen ads on auth, onboarding, location-setup, or checkout
- No App Open ad on cold start / splash
- Pre-load; never block navigation
- Cap frequency (built in) — don't lower the cooldowns without reviewing UX
- Follow [Google Play "Better ad experiences"](https://support.google.com/googleplay/android-developer/answer/12271244) + [AdMob interstitial policy](https://support.google.com/admob/answer/6201362)
