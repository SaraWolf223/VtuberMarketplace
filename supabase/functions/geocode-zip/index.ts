import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { resolveZipCentroid } from '../_shared/zip-lookup.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limit.ts';

const ZIP_RE = /^[0-9]{5}$/;

type GeocodeBody = { zip_code?: string };

function parseZip(body: GeocodeBody): string | null {
  const raw = body.zip_code?.trim() ?? '';
  const cleaned = raw.replace(/\D/g, '').slice(0, 5);
  return ZIP_RE.test(cleaned) ? cleaned : null;
}

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

  let body: GeocodeBody;
  try {
    body = (await req.json()) as GeocodeBody;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const zip = parseZip(body);
  if (!zip) {
    return withCors(errorResponse('Enter a valid 5-digit US ZIP code', 400, 'INVALID_ZIP'));
  }

  const admin = createSupabaseAdmin();

  const geoLimit = await checkRateLimit(
    admin,
    `geocode_zip:user:${auth.user.id}`,
    60,
    60 * 60 * 1000
  );
  if (!geoLimit.ok) {
    const r = rateLimitResponse(geoLimit);
    return withCors(errorResponse(r.message, r.status, r.code));
  }

  const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
  const result = await resolveZipCentroid(admin, zip, mapboxToken);
  if (!result.ok) {
    return withCors(errorResponse(result.message, result.code === 'GEO_CONFIG' ? 500 : 400, result.code));
  }

  return withCors(okResponse(result.data));
});
