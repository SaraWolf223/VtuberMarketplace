# Google in-feed video ads (OfferUp-style)

## How OfferUp does it

OfferUp monetizes the browse feed with **programmatic third-party ads** from networks like Google, inserted **between organic listing rows** (not full-screen interruptions). Common traits:

- **In-feed native units** — full-width cards that match the marketplace UI
- **Video or rich display** — often short video that **autoplays muted** while scrolling
- **“Sponsored” attribution** — required for programmatic native ads
- **Cadence** — roughly every handful of listings so density feels like “browse, browse, ad, browse…”
- **Separate from promoted listings** — seller “promoted placements” boost listings; Google ads are independent inventory

This app mirrors that with **AdMob Native** (video-capable via `NativeMediaView`).

## Feed layout

| Interval | Slot |
|----------|------|
| Every 6 listing cells | Ad break — Google native video (`FeedGoogleVideoAd`) |

Google rows are omitted until the feed has at least `GOOGLE_FEED_ADS_MIN_LISTINGS` (6) listings.

## Placeholder vs live ads

Until your AdMob account and ad units are ready, the app shows an **OfferUp-style placeholder** (Sponsored badge, muted-video mock, CTA strip).

Enable live AdMob when ready:

1. Create **Native** ad units in AdMob (video-enabled inventory).
2. Set in `.env` / EAS secrets:
   - `EXPO_PUBLIC_ADMOB_IOS_NATIVE_VIDEO_ID`
   - `EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_VIDEO_ID`
   - `EXPO_PUBLIC_GOOGLE_FEED_VIDEO_ADS_LIVE=true`
3. Rebuild the native app (`expo prebuild` + dev client / EAS build).
4. Use **UMP consent** before production (EEA) — see [Google UMP](https://developers.google.com/admob/ump).

In development, test IDs are used automatically when `GOOGLE_FEED_VIDEO_ADS_LIVE=true` and production unit IDs are unset.

## Compliance

- No ads on auth, onboarding, or location-setup flows
- Do not click your own ads in production
- Follow [Google Play ads policy](https://support.google.com/googleplay/android-developer/answer/9857753)
