/**
 * RETIRED — VTuber Marketplace is a global catalog (no ZIP/radius geo).
 * Kept as a 410 stub so old clients fail clearly instead of geocoding.
 */
import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/errors.ts';

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return withCors(
    errorResponse(
      'ZIP geocoding is retired. This marketplace uses a global digital catalog.',
      410,
      'GEO_RETIRED'
    )
  );
});
