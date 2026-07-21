import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';
import { hashCollegeOtp, getCollegeOtpSecret, normalizeCollegeEmail } from '../_shared/college-email.ts';
import { constantTimeEqual } from '../_shared/ct-compare.ts';

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

  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as { email?: string; code?: string };
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const email = normalizeCollegeEmail(body.email ?? '');
  const code = body.code?.trim() ?? '';
  if (!email || !/^\d{6}$/.test(code)) {
    return withCors(errorResponse('Invalid email or code', 400, 'BAD_REQUEST'));
  }

  let secret: string;
  try {
    secret = getCollegeOtpSecret();
  } catch {
    return withCors(errorResponse('Server not configured', 500, 'CONFIG'));
  }

  try {
    const admin = createSupabaseAdmin();

    const verifyLimit = await checkRateLimit(
      admin,
      `college_otp_verify:user:${auth.user.id}`,
      10,
      60 * 60 * 1000
    );
    if (!verifyLimit.ok) {
      const r = rateLimitResponse(verifyLimit);
      return withCors(errorResponse(r.message, r.status, r.code));
    }

    const { data: row } = await admin
      .from('college_email_verification_codes')
      .select('email, code_hash, expires_at')
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (!row || row.email !== email) {
      return withCors(errorResponse('Request a new code first', 400, 'NO_CODE'));
    }

    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      return withCors(errorResponse('Code expired — request a new one', 400, 'EXPIRED'));
    }

    const expected = await hashCollegeOtp(code, secret);
    if (!constantTimeEqual(expected, (row.code_hash as string) ?? '')) {
      return withCors(errorResponse('Incorrect code', 400, 'INVALID_CODE'));
    }

    const { data: existing } = await admin
      .from('profiles')
      .select('college_badge_expires_at, college_reverify_deadline_at')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (
      existing?.college_badge_expires_at &&
      existing?.college_reverify_deadline_at &&
      new Date(existing.college_badge_expires_at as string).getTime() <= Date.now() &&
      new Date(existing.college_reverify_deadline_at as string).getTime() <= Date.now()
    ) {
      await admin.rpc('purge_expired_college_badges');
      return withCors(
        errorResponse(
          'Re-verification period ended. Request a new code to verify your .edu email again.',
          400,
          'REVERIFY_EXPIRED'
        )
      );
    }

    const verifiedAt = new Date().toISOString();
    const expiresMs = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(expiresMs).toISOString();
    const reverifyDeadlineAt = new Date(expiresMs + 10 * 24 * 60 * 60 * 1000).toISOString();

    await admin
      .from('profiles')
      .update({
        college_edu_email: email,
        college_badge_verified_at: verifiedAt,
        college_badge_expires_at: expiresAt,
        college_reverify_deadline_at: reverifyDeadlineAt,
        updated_at: verifiedAt,
      })
      .eq('id', auth.user.id);

    await admin
      .from('college_email_verification_codes')
      .delete()
      .eq('user_id', auth.user.id);

    return withCors(
      okResponse({
        college_badge_expires_at: expiresAt,
        college_reverify_deadline_at: reverifyDeadlineAt,
        college_edu_email: email,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Verify failed';
    return withCors(errorResponse(message, 500, 'VERIFY_FAILED'));
  }
});
