import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireCronAuth } from '../_shared/cron-auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

/** Cron / service: remove college badge data after re-verify grace period ends. */
Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const cronDenied = requireCronAuth(req);
  if (cronDenied) {
    return cronDenied;
  }

  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.rpc('purge_expired_college_badges');

    if (error) {
      return withCors(errorResponse(error.message, 500, 'PURGE_FAILED'));
    }

    return withCors(okResponse({ purged: data ?? 0 }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Purge failed';
    return withCors(errorResponse(message, 500, 'PURGE_FAILED'));
  }
});
