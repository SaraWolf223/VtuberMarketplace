import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireCronAuth } from '../_shared/cron-auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { hardDeleteListing } from '../_shared/hard-delete-listing.ts';

/** Cron / service: hard-delete listings past purge_at. */
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
    const now = new Date().toISOString();

    const { data: toPurge, error } = await admin
      .from('listings')
      .select('id')
      .lte('purge_at', now)
      .limit(100);

    if (error) {
      return withCors(errorResponse(error.message, 500, 'QUERY_FAILED'));
    }

    let purged = 0;
    const errors: string[] = [];

    for (const row of toPurge ?? []) {
      try {
        await hardDeleteListing(admin, row.id);
        purged += 1;
      } catch (e) {
        errors.push(`${row.id}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return withCors(
      okResponse({
        purged,
        candidates: toPurge?.length ?? 0,
        errors: errors.length ? errors : undefined,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Purge failed';
    return withCors(errorResponse(message, 500, 'PURGE_FAILED'));
  }
});
