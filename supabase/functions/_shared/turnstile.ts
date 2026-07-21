// Server-side verification for Cloudflare Turnstile (bot/abuse protection —
// Phase 9 of the white-label plan). The site key is public (shipped in the
// website config / app bundle); only the secret key must stay server-only.
//
// Verification is a no-op (always passes) when TURNSTILE_SECRET_KEY isn't
// set, so a fresh buyer deployment isn't blocked from launching before they
// set up Cloudflare — same "resilient fallback" pattern used for
// RESEND_API_KEY/email templates elsewhere in this codebase. Once the secret
// is configured, verification is enforced and a missing/invalid token fails
// the request.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult = { ok: true } | { ok: false; message: string };

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<TurnstileResult> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    // Not configured yet — allow through (see module comment).
    return { ok: true };
  }

  if (!token || !token.trim()) {
    return { ok: false, message: 'Bot verification is required. Please try again.' };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (remoteIp) form.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, { method: 'POST', body: form });
    if (!res.ok) {
      // Cloudflare is unreachable/erroring — fail closed so an outage doesn't
      // silently disable bot protection, but keep the message generic.
      return { ok: false, message: 'Could not verify you are not a robot. Try again in a moment.' };
    }
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return { ok: false, message: 'Bot verification failed. Refresh the page and try again.' };
    }
    return { ok: true };
  } catch (e) {
    console.error('[turnstile] verify request failed:', e);
    return { ok: false, message: 'Could not verify you are not a robot. Try again in a moment.' };
  }
}
