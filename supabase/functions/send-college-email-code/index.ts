import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import {
  generateCollegeOtp,
  getCollegeOtpSecret,
  hashCollegeOtp,
  normalizeCollegeEmail,
  sendCollegeOtpEmail,
} from '../_shared/college-email.ts';

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireUser(req);
  if ('response' in auth) {
    return withCors(auth.response);
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const email = normalizeCollegeEmail(body.email ?? '');
  if (!email) {
    return withCors(
      errorResponse('Enter a valid .edu email address', 400, 'INVALID_EMAIL')
    );
  }

  let secret: string;
  try {
    secret = getCollegeOtpSecret();
  } catch {
    return withCors(errorResponse('Server not configured', 500, 'CONFIG'));
  }

  try {
    const admin = createSupabaseAdmin();

    const { data: profile } = await admin
      .from('profiles')
      .select('college_badge_expires_at, college_reverify_deadline_at')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profile?.college_badge_expires_at && profile?.college_reverify_deadline_at) {
      const expired = new Date(profile.college_badge_expires_at as string).getTime() <= Date.now();
      const pastGrace =
        new Date(profile.college_reverify_deadline_at as string).getTime() <= Date.now();
      if (expired && pastGrace) {
        await admin.rpc('purge_expired_college_badges');
        return withCors(
          errorResponse(
            'College verification expired. Verify a .edu email again to get the badge.',
            400,
            'REVERIFY_EXPIRED'
          )
        );
      }
    }

    const userLimit = await checkRateLimit(
      admin,
      `college_otp_send:user:${auth.user.id}`,
      3,
      60 * 60 * 1000
    );
    if (!userLimit.ok) {
      const r = rateLimitResponse(userLimit);
      return withCors(errorResponse(r.message, r.status, r.code));
    }

    const domain = email.split('@')[1] ?? '';
    const domainLimit = await checkRateLimit(
      admin,
      `college_otp_send:domain:${domain}`,
      10,
      24 * 60 * 60 * 1000
    );
    if (!domainLimit.ok) {
      const r = rateLimitResponse(domainLimit);
      return withCors(errorResponse(r.message, r.status, r.code));
    }

    const code = generateCollegeOtp();
    const codeHash = await hashCollegeOtp(code, secret);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await admin.from('college_email_verification_codes').upsert({
      user_id: auth.user.id,
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    await sendCollegeOtpEmail(admin, email, code);

    return withCors(okResponse({ sent: true, expires_at: expiresAt }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Send failed';
    return withCors(errorResponse(message, 500, 'SEND_FAILED'));
  }
});
