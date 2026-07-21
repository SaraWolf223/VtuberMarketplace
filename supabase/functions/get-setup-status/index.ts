import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';

/**
 * Admin-only setup checklist for server/edge-function-only secrets.
 *
 * Returns presence + light format checks ONLY — never the actual secret
 * value — so this is safe to call from the client. Client-bundle vars
 * (EXPO_PUBLIC_*) are checked directly in the app instead of here, since
 * the edge runtime does not have access to those build-time values.
 */

type CheckResult = {
  key: string;
  configured: boolean;
  looksValid: boolean | null;
  note: string;
};

function check(
  key: string,
  note: string,
  validate?: (value: string) => boolean
): CheckResult {
  const value = Deno.env.get(key)?.trim() ?? '';
  const configured = value.length > 0;
  return {
    key,
    configured,
    looksValid: configured && validate ? validate(value) : configured ? true : null,
    note,
  };
}

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireAdmin(req);
  if ('response' in auth) {
    return withCors(auth.response);
  }

  const checks: CheckResult[] = [
    check(
      'SUPABASE_SERVICE_ROLE_KEY',
      'Required for edge functions to read/write with elevated access.',
      (v) => v.length > 40
    ),
    check(
      'STRIPE_SECRET_KEY',
      'Required for boost/Premium checkout + webhook processing.',
      (v) => v.startsWith('sk_')
    ),
    check(
      'STRIPE_WEBHOOK_SECRET',
      'Required so Stripe webhook events are verified, not just trusted blindly.',
      (v) => v.startsWith('whsec_')
    ),
    check(
      'STRIPE_PRICE_PREMIUM',
      'The recurring price ID charged for Premium subscriptions.',
      (v) => v.startsWith('price_')
    ),
    check(
      'MAPBOX_ACCESS_TOKEN',
      'Server-side geocoding fallback for ZIP -> coordinates.',
      (v) => v.startsWith('pk.') || v.startsWith('sk.')
    ),
    check(
      'RESEND_API_KEY',
      'Without this, transactional emails are logged to the function console instead of sent.',
      (v) => v.startsWith('re_')
    ),
    check('SUPPORT_EMAIL', 'Receives staff notifications (new reports, bans, waitlist signups).'),
    check(
      'CRON_SECRET',
      'REQUIRED in production — protects the scheduled purge-expired-* endpoints.',
      (v) => v.length >= 16
    ),
    check(
      'COLLEGE_OTP_SECRET',
      'REQUIRED in production — HMAC secret for .edu verification codes (must differ from the service role key).',
      (v) => v.length >= 16
    ),
    check(
      'CORS_ALLOWED_ORIGINS',
      'Restricts which web origins may call these functions in production.',
      (v) => !v.includes('yourdomain.com')
    ),
    check(
      'TURNSTILE_SECRET_KEY',
      'Optional bot protection for the waitlist + sign-up forms — pairs with the public site key in waitlist-config.js / EXPO_PUBLIC_TURNSTILE_SITE_KEY. Skipped (not required) if unset.',
      (v) => v.length >= 10
    ),
  ];

  return withCors(okResponse({ checks }));
});
