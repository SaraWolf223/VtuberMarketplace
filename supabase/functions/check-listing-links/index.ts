/**
 * Scheduled link health check for listing download_url / order deliverable_url.
 * Invoke via cron with service role (Authorization: Bearer SERVICE_ROLE_KEY).
 */
import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const FAILURE_THRESHOLD = 2;
const GRACE_HOURS_DEFAULT = 48;

async function headOk(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 405 || res.status === 403 || res.status === 400) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { Range: 'bytes=0-0' },
      });
      return getRes.ok || getRes.status === 206;
    }
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || !auth.includes(serviceKey)) {
    return withCors(errorResponse('Service role required', 401, 'UNAUTHORIZED'));
  }

  try {
    const admin = createSupabaseAdmin();
    const { data: graceCfg } = await admin
      .from('public_app_config')
      .select('value')
      .eq('key', 'link_health_grace_hours')
      .maybeSingle();
    const graceHours = Number(graceCfg?.value ?? GRACE_HOURS_DEFAULT) || GRACE_HOURS_DEFAULT;

    const { data: listings } = await admin
      .from('listings')
      .select('id, seller_id, download_url, status')
      .eq('status', 'active')
      .not('download_url', 'is', null)
      .limit(80);

    let checked = 0;
    let opened = 0;

    for (const listing of listings ?? []) {
      if (!listing.download_url) continue;
      checked += 1;
      const ok = await headOk(listing.download_url as string);

      const { data: existing } = await admin
        .from('link_health_checks')
        .select('*')
        .eq('listing_id', listing.id)
        .maybeSingle();

      if (ok) {
        if (existing?.issue_open) {
          await admin
            .from('link_health_checks')
            .update({
              consecutive_failures: 0,
              last_checked_at: new Date().toISOString(),
              last_status: 'ok',
              issue_open: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else if (existing) {
          await admin
            .from('link_health_checks')
            .update({
              consecutive_failures: 0,
              last_checked_at: new Date().toISOString(),
              last_status: 'ok',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        }
        continue;
      }

      const failures = (existing?.consecutive_failures ?? 0) + 1;
      const openIssue = failures >= FAILURE_THRESHOLD;
      const graceEnds = new Date(Date.now() + graceHours * 3600_000).toISOString();

      if (existing) {
        await admin
          .from('link_health_checks')
          .update({
            consecutive_failures: failures,
            last_checked_at: new Date().toISOString(),
            last_status: 'fail',
            issue_open: openIssue || existing.issue_open,
            grace_ends_at: openIssue ? existing.grace_ends_at ?? graceEnds : existing.grace_ends_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await admin.from('link_health_checks').insert({
          listing_id: listing.id,
          seller_id: listing.seller_id,
          target_url: listing.download_url,
          consecutive_failures: failures,
          last_checked_at: new Date().toISOString(),
          last_status: 'fail',
          issue_open: openIssue,
          grace_ends_at: openIssue ? graceEnds : null,
        });
      }

      if (openIssue) {
        opened += 1;
        await admin
          .from('listings')
          .update({ status: 'paused_pending_review', updated_at: new Date().toISOString() })
          .eq('id', listing.id)
          .eq('status', 'active');
      }
    }

    return withCors(okResponse({ checked, opened }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Link check failed';
    return withCors(errorResponse(message, 500, 'CHECK_FAILED'));
  }
});
