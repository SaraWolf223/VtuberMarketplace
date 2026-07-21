import { withCors, corsHeaders, bindCorsRequest, isOriginAllowed } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { notifyStaff } from '../_shared/staff-notify.ts';
import { renderEmailTemplate } from '../_shared/email-templates.ts';
import { verifyTurnstileToken } from '../_shared/turnstile.ts';

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.headers.get('cf-connecting-ip')?.trim() || 'unknown';
}

type JoinIosWaitlistResult = {
  already_registered: boolean;
  message: string;
};

function mapError(raw: string): { message: string; status: number; code: string } {
  if (raw.includes('INVALID_EMAIL')) {
    return { message: 'Enter a valid email address.', status: 400, code: 'INVALID_EMAIL' };
  }
  if (raw.includes('INVALID_ZIP')) {
    return { message: 'Enter a valid 5-digit US ZIP code, or leave ZIP blank.', status: 400, code: 'INVALID_ZIP' };
  }
  if (raw.includes('WAITLIST_CAPACITY')) {
    return {
      message: 'Waitlist is full for today. Try again tomorrow.',
      status: 503,
      code: 'WAITLIST_CAPACITY',
    };
  }
  return {
    message: 'Could not join the iPhone waitlist. Try again later.',
    status: 500,
    code: 'WAITLIST_FAILED',
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

  if (!isOriginAllowed(req)) {
    return withCors(errorResponse('Origin not allowed', 403, 'FORBIDDEN'));
  }

  let body: {
    email?: string;
    zip?: string;
    source?: string;
    website?: string;
    turnstileToken?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  if (body.website?.trim()) {
    return withCors(
      okResponse({
        already_registered: false,
        message: 'Thanks!',
      } satisfies JoinIosWaitlistResult)
    );
  }

  const email = body.email?.trim();
  const zip = body.zip?.trim() || null;
  const source = body.source?.trim() || 'landing-page-ios';

  if (!email) {
    return withCors(errorResponse('email is required', 400, 'BAD_REQUEST'));
  }

  try {
    const admin = createSupabaseAdmin();
    const ip = clientIp(req);
    const emailKey = email.toLowerCase();

    const turnstile = await verifyTurnstileToken(body.turnstileToken, ip);
    if (!turnstile.ok) {
      return withCors(errorResponse(turnstile.message, 403, 'BOT_CHECK_FAILED'));
    }

    const ipLimit = await checkRateLimit(admin, `ios-waitlist:ip:${ip}`, 10, 60 * 60 * 1000);
    if (!ipLimit.ok) {
      const r = rateLimitResponse(ipLimit);
      return withCors(errorResponse(r.message, r.status, r.code));
    }

    const emailLimit = await checkRateLimit(
      admin,
      `ios-waitlist:email:${emailKey}`,
      3,
      24 * 60 * 60 * 1000
    );
    if (!emailLimit.ok) {
      const r = rateLimitResponse(emailLimit);
      return withCors(errorResponse(r.message, r.status, r.code));
    }

    const { data, error } = await admin.rpc('register_ios_waitlist_signup', {
      p_email: email,
      p_zip: zip,
      p_source: source,
    });

    if (error) {
      const mapped = mapError(error.message);
      return withCors(errorResponse(mapped.message, mapped.status, mapped.code));
    }

    const result = data as JoinIosWaitlistResult;

    if (!result.already_registered) {
      const rendered = await renderEmailTemplate(
        admin,
        'ios_waitlist_signup_admin',
        { email, zip: zip ?? '—', source, joined_at: new Date().toISOString() },
        {
          subject: `New iPhone waitlist signup${zip ? ` — ${zip}` : ''}`,
          body:
            `A new person joined the {{app_name}} iPhone waitlist.\n\n` +
            `Email: {{email}}\n` +
            `ZIP: {{zip}}\n` +
            `Source: {{source}}\n` +
            `Joined: {{joined_at}}`,
        }
      );

      await notifyStaff({
        event: 'waitlist_signup',
        subject: rendered.subject,
        adminBody: rendered.body,
      });
    }

    return withCors(okResponse(result));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'iPhone waitlist signup failed';
    return withCors(errorResponse(message, 500, 'WAITLIST_FAILED'));
  }
});
