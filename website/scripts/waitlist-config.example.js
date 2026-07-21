/**
 * Copy to waitlist-config.js and fill in before deploying the marketing site.
 *
 * Founding Seller codes are created automatically via Supabase Edge Function `join-waitlist`.
 * Use the same project as the mobile app (EXPO_PUBLIC_SUPABASE_* in .env).
 */
window.LOCAL_MARKETPLACE_WAITLIST = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  source: 'landing-page',
  /** Optional: also send a copy to Formspree for your inbox */
  formspreeEndpoint: '',
  /**
   * Optional bot protection (Phase 9 white-label plan). Create a widget at
   * https://dash.cloudflare.com/?to=/:account/turnstile (Managed challenge is
   * fine) and paste its **Site Key** here — this value is public by design.
   * Set the matching **Secret Key** as `TURNSTILE_SECRET_KEY` in your
   * Supabase Edge Function secrets (never here). Leave blank to skip bot
   * protection on the waitlist forms.
   */
  turnstileSiteKey: '',
  /**
   * Optional: override the origin used to build referral share links
   * (e.g. behind a CDN/proxy where the visible domain differs from
   * `window.location.origin`). Leave blank to use the page's own origin —
   * correct for almost every deployment, no setup required.
   */
  siteOrigin: '',
};
