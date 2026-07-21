import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

function devPhoneStubAllowed(): boolean {
  // Fail closed. The stub bypasses SMS phone verification, so it must NEVER be
  // available unless explicitly enabled, and never in production. Supabase does
  // not set ENVIRONMENT/DENO_ENV by default, so a prod project that simply
  // deploys this function gets a hard deny (not a silent allow).
  const isProd =
    Deno.env.get('DENO_ENV') === 'production' || Deno.env.get('ENVIRONMENT') === 'production';
  if (isProd) return false;
  return Deno.env.get('ALLOW_DEV_PHONE_STUB') === 'true';
}

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  if (!devPhoneStubAllowed()) {
    return withCors(
      errorResponse(
        'Dev phone stub is disabled. Set ALLOW_DEV_PHONE_STUB=true in Supabase secrets for QA projects.',
        403,
        'FORBIDDEN'
      )
    );
  }

  const auth = await requireUser(req);
  if ('response' in auth) {
    return withCors(auth.response);
  }

  let body: { phone?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const rawPhone = body.phone?.trim() ?? '';
  const phone = rawPhone || '+10000000000';

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from('profiles')
    .update({
      phone,
      phone_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.user.id);

  if (error) {
    return withCors(errorResponse('Could not mark phone verified', 500, 'UPDATE_FAILED'));
  }

  return withCors(okResponse({ phone, verified: true }));
});
